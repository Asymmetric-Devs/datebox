"""
Main FastAPI application for the LangGraph Agent.
"""

from contextlib import asynccontextmanager
from typing import Any
import uvicorn

from fastapi import FastAPI, HTTPException
from langchain_google_genai import ChatGoogleGenerativeAI

from src.config import get_settings
from src.graph import create_agent_graph
from src.types import InvokeAgentRequest
from src.api import (
    invoke_agent_handler,
    get_conversation_handler,
    clear_conversation_handler,
    health_check_handler
)
from src.utils import log_info, log_error, set_debug_mode


# Global variables
app: FastAPI | None = None
graph_instance: Any = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for application startup and shutdown."""
    global graph_instance
    
    try:
        settings = get_settings()
        set_debug_mode(settings.debug)
        
        log_info("Initializing LangGraph Agent...")
        
        # Validate API key
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        
        log_info("LLM Config loaded", {"model": settings.gemini_model})
        
        # Initialize Gemini LLM
        llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            api_key=settings.gemini_api_key,
            temperature=settings.gemini_temperature,
            max_output_tokens=settings.gemini_max_tokens,
            top_p=settings.gemini_top_p,
        )
        
        log_info("Gemini LLM initialized")
        
        # Create agent graph
        graph_instance = create_agent_graph(llm)
        log_info("Agent graph compiled")
        
        yield
        
        log_info("Agent shutting down gracefully")
        
    except Exception as error:
        log_error("Failed to initialize agent", error)
        raise


def create_app() -> FastAPI:
    """Create FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="Datebox LangGraph Agent",
        description="AI Agent for Datebox group sharing",
        version="0.1.0",
        lifespan=lifespan
    )
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return health_check_handler()
    
    # Invoke agent endpoint
    @app.post("/agent/invoke")
    async def invoke_agent(request: InvokeAgentRequest):
        """Invoke the agent."""
        try:
            if not graph_instance:
                raise RuntimeError("Agent not initialized")
            
            response = await invoke_agent_handler(request, graph_instance)
            return response
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            log_error("Error invoking agent", e)
            raise HTTPException(status_code=500, detail=str(e))
    
    # Get conversation history endpoint
    @app.get("/agent/conversations/{conversation_id}")
    async def get_conversation(conversation_id: str):
        """Get conversation history."""
        try:
            return get_conversation_handler(conversation_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # Clear conversation endpoint
    @app.delete("/agent/conversations/{conversation_id}")
    async def clear_conversation(conversation_id: str):
        """Clear conversation."""
        try:
            return clear_conversation_handler(conversation_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # 404 handler
    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE"])
    async def not_found(path_name: str):
        """Handle 404 requests."""
        raise HTTPException(status_code=404, detail="Endpoint not found")
    
    return app


if __name__ == "__main__":
    
    app = create_app()
    settings = get_settings()
    
    log_info("Starting datebox Agent Server", {
        "host": settings.agent_host,
        "port": settings.agent_port
    })
    
    uvicorn.run(
        app,
        host=settings.agent_host,
        port=settings.agent_port,
        log_level=settings.log_level.lower()
    )
