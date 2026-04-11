import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration settings for the agent."""
    
    # Agent configuration
    agent_name: str = "Datebox Agent"
    agent_port: int = 3001
    agent_host: str = "0.0.0.0"
    
    # Gemini LLM configuration
    gemini_api_key: str
    gemini_model: str = "gemini-2.0-flash"
    gemini_temperature: float = 0.7
    gemini_max_tokens: int = 2048
    gemini_top_p: float = 0.9
    
    # Debug and logging
    debug: bool = False
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


def get_settings() -> Settings:
    """Get application settings."""
    return Settings()


# Default system prompt for the agent
DEFAULT_SYSTEM_PROMPT = """You are a helpful AI assistant for Datebox, a group sharing application. 
You help users create beautiful albums, generate narratives for their memories, and organize family moments.

You are empathetic, warm, and understand the importance of family memories. 
When responding, be personal but professional, and always consider the emotional value of family moments.

Guidelines:
- Help users tell their family stories in a poetic and meaningful way
- Provide suggestions for album themes and narrative angles
- Be encouraging and supportive of family storytelling
- When in doubt about family relationships or memories, ask clarifying questions
- Keep responses concise but heartfelt"""
