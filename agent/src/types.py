from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from enum import Enum


class MessageRole(str, Enum):
    """Message roles in conversation."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


@dataclass
class Message:
    """Message in conversation."""
    role: MessageRole
    content: str
    timestamp: Optional[str] = None


@dataclass
class ConversationMetadata:
    """Metadata for a conversation."""
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    created_at: Optional[str] = None


@dataclass
class AgentState:
    """State for the LangGraph agent."""
    messages: list[Message] = field(default_factory=list)
    context: Optional[Dict[str, Any]] = None
    metadata: Optional[ConversationMetadata] = None


@dataclass
class InvokeAgentRequest:
    """Request to invoke the agent."""
    message: str
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


@dataclass
class InvokeAgentResponse:
    """Response from agent invocation."""
    conversation_id: str
    message: str
    timestamp: str
    metadata: Optional[Dict[str, Any]] = None


class Tool:
    """Base tool interface for the agent."""
    name: str
    description: str
    
    async def execute(self, input_data: Dict[str, Any]) -> str:
        """Execute the tool."""
        raise NotImplementedError
