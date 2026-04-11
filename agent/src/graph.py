"""
LangGraph agent implementation.
Main agent logic with message processing and state management.
"""

from typing import Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph
from src.types import AgentState, Message, MessageRole
from src.config import DEFAULT_SYSTEM_PROMPT
from src.utils import log_error, log_debug


def create_agent_graph(model: ChatGoogleGenerativeAI) -> StateGraph:
    """Create the LangGraph agent graph."""
    
    graph = StateGraph(AgentState)
    
    async def process_messages_node(state: AgentState) -> AgentState:
        """Process messages and generate response."""
        try:
            # Convert stored messages to LangChain format
            lc_messages = []
            
            for msg in state.messages:
                if msg.role == MessageRole.USER:
                    lc_messages.append(HumanMessage(content=msg.content))
                elif msg.role == MessageRole.ASSISTANT:
                    lc_messages.append(AIMessage(content=msg.content))
                elif msg.role == MessageRole.SYSTEM:
                    lc_messages.append(SystemMessage(content=msg.content))
            
            # Build system prompt with context
            system_prompt = DEFAULT_SYSTEM_PROMPT
            
            if state.metadata and state.metadata.user_id:
                system_prompt += f"\n\nUser ID: {state.metadata.user_id}"
            
            if state.context:
                context_str = "\n".join(
                    f"- {k}: {v}" for k, v in state.context.items()
                )
                system_prompt += f"\n\nContext:\n{context_str}"
            
            log_debug("Processing message", {
                "message_count": len(state.messages),
                "has_context": bool(state.context)
            })
            
            # Invoke the model
            response = await model.ainvoke(
                lc_messages,
                config={"system": system_prompt}
            )
            
            # Extract response content
            assistant_message = response.content or "I apologize, but I could not generate a response."
            
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
