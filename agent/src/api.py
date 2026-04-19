"""
API handlers for the agent.
Handles HTTP requests and manages conversation state.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import uuid4
import time

from fastapi import Request, HTTPException
from src.types import (
    AgentState, Message, MessageRole, 
    InvokeAgentRequest, InvokeAgentResponse,
    ConversationMetadata
)
from src.utils import log_debug, log_info, log_error


# In-memory conversation store
# In production, this would be backed by a database (Supabase)
_conversation_store: dict[str, AgentState] = {}


def _coerce_state(raw_state: Any, fallback_state: AgentState) -> AgentState:
    """Normalize LangGraph output to AgentState.

    Newer LangGraph versions may return dict-like state objects.
    """
    if isinstance(raw_state, AgentState):
        return raw_state

    if isinstance(raw_state, dict):
        raw_messages = raw_state.get("messages", fallback_state.messages)
        messages: list[Message] = []
        for msg in raw_messages:
            if isinstance(msg, Message):
                messages.append(msg)
            elif isinstance(msg, dict):
                role_value = msg.get("role", MessageRole.USER.value)
                try:
                    role = MessageRole(role_value)
                except ValueError:
                    role = MessageRole.USER
                messages.append(
                    Message(
                        role=role,
                        content=str(msg.get("content", "")),
                        timestamp=msg.get("timestamp"),
                    )
                )

        metadata = fallback_state.metadata
        context = fallback_state.context
        return AgentState(messages=messages, context=context, metadata=metadata)

    return fallback_state


async def invoke_agent_handler(
    request: InvokeAgentRequest,
    graph: Any  # langgraph.graph.CompiledGraph
) -> InvokeAgentResponse:
    """Handle agent invocation."""
    
    if not request.message or request.message.strip() == "":
        raise ValueError("Message is required")
    
    # Generate or use existing conversation ID
    conversation_id = request.conversation_id or str(uuid4())
    
    # Get or create conversation state
    if conversation_id in _conversation_store:
        state = _conversation_store[conversation_id]

        if request.context:
            merged_context = (state.context or {}).copy()
            merged_context.update(request.context)
            state.context = merged_context

        if request.user_id and state.metadata:
            state.metadata.user_id = request.user_id
    else:
        state = AgentState(
            messages=[],
            context=request.context,
            metadata=ConversationMetadata(
                user_id=request.user_id,
                conversation_id=conversation_id,
                created_at=datetime.now().isoformat()
            )
        )
    
    # Add user message to state
    state.messages.append(
        Message(
            role=MessageRole.USER,
            content=request.message,
            timestamp=datetime.now().isoformat()
        )
    )
    
    log_debug("Processing message", {
        "conversation_id": conversation_id,
        "message_length": len(request.message)
    })
    
    start_time = time.time()
    
    # Invoke the graph
    raw_result_state = await graph.ainvoke(state)
    result_state = _coerce_state(raw_result_state, state)
    
    execution_time = time.time() - start_time
    
    log_info("Message processed successfully", {
        "conversation_id": conversation_id,
        "execution_time": execution_time
    })
    
    # Update stored state
    _conversation_store[conversation_id] = result_state
    
    # Get the last assistant message
    assistant_messages = [
        msg for msg in result_state.messages 
        if msg.role == MessageRole.ASSISTANT
    ]
    
    last_message = assistant_messages[-1].content if assistant_messages else "No response generated"
    
    return InvokeAgentResponse(
        conversation_id=conversation_id,
        message=last_message,
        timestamp=datetime.now().isoformat(),
        metadata={
            "execution_time_ms": int(execution_time * 1000)
        }
    )


def get_conversation_handler(conversation_id: str) -> dict:
    """Get conversation history."""
    
    if not conversation_id:
        raise ValueError("Conversation ID is required")
    
    if conversation_id not in _conversation_store:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    state = _conversation_store[conversation_id]
    
    return {
        "conversation_id": conversation_id,
        "messages": [
            {
                "role": msg.role.value,
                "content": msg.content,
                "timestamp": msg.timestamp
            }
            for msg in state.messages
        ],
        "metadata": {
            "user_id": state.metadata.user_id if state.metadata else None,
            "created_at": state.metadata.created_at if state.metadata else None,
        }
    }


def clear_conversation_handler(conversation_id: str) -> dict:
    """Clear conversation from memory."""
    
    if not conversation_id:
        raise ValueError("Conversation ID is required")
    
    if conversation_id not in _conversation_store:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    del _conversation_store[conversation_id]
    
    log_info("Conversation cleared", {"conversation_id": conversation_id})
    
    return {
        "message": "Conversation cleared successfully",
        "conversation_id": conversation_id
    }


def health_check_handler() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "conversations_active": len(_conversation_store)
    }
