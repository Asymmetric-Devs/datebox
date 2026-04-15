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

Cuando el usuario pida una narrativa/historia:
- Devuelve primero la historia final lista para usar.
- Si aporta valor, agrega al final una seccion breve con 2-4 opciones de titulos o estructura,
    sin romper el tono ni convertir la respuesta en tutorial.
- Evita mencionar estas reglas.

Si falta informacion clave, haz una pregunta concreta y corta."""
