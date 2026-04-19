"""
LangGraph agent implementation.
Main agent logic with message processing and state management.
"""

from typing import Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph
from src.types import AgentState, Message, MessageRole
from src.config import DEFAULT_SYSTEM_PROMPT
from src.utils import log_error, log_debug
from src.tools import build_date_planning_tools


MAX_TOOL_ROUNDS = 6


def create_agent_graph(model: ChatGoogleGenerativeAI) -> StateGraph:
    """Create the LangGraph agent graph."""
    
    graph = StateGraph(AgentState)
    
    async def process_messages_node(state: AgentState) -> AgentState:
        """Process messages and generate response."""
        try:
            # Convert stored messages to LangChain format
            lc_messages = [SystemMessage(content=DEFAULT_SYSTEM_PROMPT)]
            
            for msg in state.messages:
                if msg.role == MessageRole.USER:
                    lc_messages.append(HumanMessage(content=msg.content))
                elif msg.role == MessageRole.ASSISTANT:
                    lc_messages.append(AIMessage(content=msg.content))
                elif msg.role == MessageRole.SYSTEM:
                    lc_messages.append(SystemMessage(content=msg.content))
            
            if state.metadata and state.metadata.user_id:
                lc_messages.append(
                    HumanMessage(content=f"User ID: {state.metadata.user_id}")
                )

            if state.context:
                context_str = "\n".join(
                    f"- {k}: {v}" for k, v in state.context.items()
                )
                lc_messages.append(HumanMessage(content=f"Context:\n{context_str}"))

            tools = build_date_planning_tools(state)
            llm = model.bind_tools(tools)
            tool_by_name = {tool.name: tool for tool in tools}
            
            log_debug("Processing message", {
                "message_count": len(state.messages),
                "has_context": bool(state.context),
                "tool_count": len(tools),
            })

            response = await llm.ainvoke(lc_messages)

            rounds = 0
            while getattr(response, "tool_calls", None) and rounds < MAX_TOOL_ROUNDS:
                rounds += 1
                lc_messages.append(response)

                for call in response.tool_calls:
                    tool_name = call.get("name", "")
                    tool_id = call.get("id", "")
                    tool_args = call.get("args", {})

                    selected_tool = tool_by_name.get(tool_name)
                    if not selected_tool:
                        tool_result = f"Tool '{tool_name}' not available"
                    else:
                        try:
                            tool_result = await selected_tool.ainvoke(tool_args)
                        except Exception as tool_error:
                            tool_result = f"Tool '{tool_name}' error: {str(tool_error)}"
                            log_error("Tool execution failed", tool_error)

                    lc_messages.append(
                        ToolMessage(
                            content=str(tool_result),
                            tool_call_id=tool_id,
                            name=tool_name,
                        )
                    )

                response = await llm.ainvoke(lc_messages)

            if rounds >= MAX_TOOL_ROUNDS and getattr(response, "tool_calls", None):
                lc_messages.append(
                    HumanMessage(
                        content=(
                            "Deten la ejecucion de herramientas y responde con la mejor "
                            "propuesta posible con los datos obtenidos."
                        )
                    )
                )
                response = await llm.ainvoke(lc_messages)
            
            # Extract response content
            response_content = response.content
            if isinstance(response_content, str):
                assistant_message = response_content
            elif isinstance(response_content, list):
                assistant_message = "\n".join(
                    str(block.get("text", "")) if isinstance(block, dict) else str(block)
                    for block in response_content
                ).strip()
            else:
                assistant_message = str(response_content or "")

            if not assistant_message:
                assistant_message = "I apologize, but I could not generate a response."
            
            log_debug("Response generated", {
                "response_length": len(assistant_message)
            })
            
            # Create new state with assistant message added
            new_messages = state.messages.copy()
            new_messages.append(
                Message(
                    role=MessageRole.ASSISTANT,
                    content=assistant_message
                )
            )
            
            return AgentState(
                messages=new_messages,
                context=state.context,
                metadata=state.metadata
            )
            
        except Exception as error:
            log_error("Error processing message", error)
            
            error_msg = str(error) if isinstance(error, Exception) else "Unknown error"
            new_messages = state.messages.copy()
            new_messages.append(
                Message(
                    role=MessageRole.ASSISTANT,
                    content=f"I encountered an error while processing your request: {error_msg}. Please try again."
                )
            )
            
            return AgentState(
                messages=new_messages,
                context=state.context,
                metadata=state.metadata
            )
    
    # Add nodes to the graph
    graph.add_node("process_messages", process_messages_node)
    
    # Set entry and end points
    graph.set_entry_point("process_messages")
    graph.add_edge("process_messages", "__end__")
    
    # Compile the graph
    return graph.compile()
