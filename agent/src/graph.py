"""
LangGraph agent implementation.
Main agent logic with message processing and state management.
"""

from typing import Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph
from src.types import AgentState, Message, MessageRole
from src.config import DEFAULT_SYSTEM_PROMPT, get_settings
from src.utils import log_error, log_debug, log_info
from src.tools import build_date_planning_tools


MAX_TOOL_ROUNDS = 6


def _preview(value: Any, max_chars: int) -> str:
    text = str(value).replace("\n", " ").strip()
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}..."


def _sanitize_tool_args(tool_args: Any) -> Any:
    if not isinstance(tool_args, dict):
        return tool_args

    redacted: dict[str, Any] = {}
    for key, value in tool_args.items():
        key_lower = key.lower()
        if any(secret in key_lower for secret in ["token", "authorization", "password", "secret"]):
            redacted[key] = "***redacted***"
        else:
            redacted[key] = value
    return redacted


def create_agent_graph(model: ChatGoogleGenerativeAI) -> StateGraph:
    """Create the LangGraph agent graph."""
    
    graph = StateGraph(AgentState)
    
    async def process_messages_node(state: AgentState) -> AgentState:
        """Process messages and generate response."""
        try:
            settings = get_settings()
            trace_enabled = settings.agent_trace_enabled
            preview_chars = max(80, settings.agent_trace_preview_chars)
            conversation_id = state.metadata.conversation_id if state.metadata else "unknown"

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

            if trace_enabled:
                log_info("Agent turn started", {
                    "conversation_id": conversation_id,
                    "messages_in_memory": len(state.messages),
                    "tool_count": len(tools),
                })

            response = await llm.ainvoke(lc_messages)

            rounds = 0
            total_tool_calls = 0
            while getattr(response, "tool_calls", None) and rounds < MAX_TOOL_ROUNDS:
                rounds += 1
                lc_messages.append(response)

                if trace_enabled:
                    log_info("Model requested tools", {
                        "conversation_id": conversation_id,
                        "round": rounds,
                        "tool_calls": len(response.tool_calls),
                    })

                for call in response.tool_calls:
                    tool_name = call.get("name", "")
                    tool_id = call.get("id", "")
                    tool_args = call.get("args", {})
                    total_tool_calls += 1

                    if trace_enabled:
                        log_info("Tool call", {
                            "conversation_id": conversation_id,
                            "round": rounds,
                            "tool": tool_name,
                            "tool_call_id": tool_id,
                            "args_preview": _preview(
                                _sanitize_tool_args(tool_args),
                                preview_chars,
                            ),
                        })

                    selected_tool = tool_by_name.get(tool_name)
                    if not selected_tool:
                        tool_result = f"Tool '{tool_name}' not available"
                    else:
                        try:
                            tool_result = await selected_tool.ainvoke(tool_args)
                        except Exception as tool_error:
                            tool_result = f"Tool '{tool_name}' error: {str(tool_error)}"
                            log_error("Tool execution failed", tool_error)

                    if trace_enabled:
                        log_info("Tool result", {
                            "conversation_id": conversation_id,
                            "round": rounds,
                            "tool": tool_name,
                            "result_preview": _preview(tool_result, preview_chars),
                        })

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

            if trace_enabled:
                log_info("Agent turn completed", {
                    "conversation_id": conversation_id,
                    "tool_rounds": rounds,
                    "total_tool_calls": total_tool_calls,
                    "response_preview": _preview(assistant_message, preview_chars),
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
