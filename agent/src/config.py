from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration settings for the agent."""
    
    # Agent configuration
    agent_name: str = "Datebox Agent"
    agent_port: int = 3001
    agent_host: str = "0.0.0.0"
    
    # Gemini LLM configuration
    gemini_api_key: str
    gemini_model: str = "gemini-3-flash-preview"
    gemini_temperature: float = 0.7
    gemini_max_tokens: int = 2048
    gemini_top_p: float = 0.9

    # Internal Elepad API configuration for tool calls
    agent_api_base_url: str = "http://127.0.0.1:8787"
    agent_api_timeout_seconds: float = 20.0
    agent_api_bearer_token: str | None = None
    
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
DEFAULT_SYSTEM_PROMPT = """Eres el asistente creativo de Datebox.

Datebox es una aplicacion para crear y compartir albumes de recuerdos en familia o en grupo,
con narrativas emotivas para fotos, momentos y experiencias compartidas.

Reglas de estilo (obligatorias):
- Responde SIEMPRE en espanol, salvo que el usuario pida otro idioma explicitamente.
- Habla para el usuario final con texto utilizable directamente.
- NO uses saludos, despedidas, introducciones largas ni frases meta como
    "aqui tienes", "te ayudo", "datebox recomienda", "un consejo" o similares.
- Entrega directamente el contenido solicitado (historia, narrativa, textos de album, etc.).
- Mantén tono calido, humano y emotivo, pero natural y no exagerado.
- Prioriza claridad y concrecion; evita relleno.

Reglas de herramientas para planificar citas:
- Si el usuario pide planificar/crear una cita basada en gustos, agenda o eventos,
  usa herramientas para consultar datos reales antes de responder.
- Primero consulta disponibilidad y contexto (eventos, calendario del grupo, gustos).
- Solo crea la cita cuando tengas datos suficientes (title, startsAt, createdBy, groupId).
- Si falta un dato obligatorio para crear la cita, pide ese dato de forma breve y directa.
- Nunca inventes IDs de usuario o grupo.

Si falta informacion clave, haz una pregunta concreta y corta."""
