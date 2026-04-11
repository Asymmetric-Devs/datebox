"""
Tools for the LangGraph Agent.
This module is structured for future extensibility.
Tools can be easily added by creating new classes in this directory.
"""

from typing import Any, Callable
from src.types import Tool


# Registry for available tools
_TOOL_REGISTRY: dict[str, Tool] = {}


def register_tool(tool: Tool) -> None:
    """Register a tool."""
    _TOOL_REGISTRY[tool.name] = tool


def get_available_tools() -> list[Tool]:
    """Get list of available tools."""
    return list(_TOOL_REGISTRY.values())


def get_tool(name: str) -> Tool | None:
    """Get a tool by name."""
    return _TOOL_REGISTRY.get(name)


async def execute_tool(name: str, input_data: dict[str, Any]) -> str:
    """Execute a tool by name."""
    tool = get_tool(name)
    if not tool:
        available = ", ".join(t.name for t in get_available_tools())
        raise ValueError(
            f"Tool '{name}' not found. Available tools: {available}"
        )
    
    return await tool.execute(input_data)


def get_tool_definitions() -> list[dict[str, Any]]:
    """Get tool definitions for LangChain."""
    return [
        {
            "name": tool.name,
            "description": tool.description,
        }
        for tool in get_available_tools()
    ]


# TODO: Add tools as needed
# Future tools could include:
# - GenerateNarrative: Generate narrative for album pages
# - AnalyzeMemories: Analyze memories for themes
# - SuggestAlbumLayout: Suggest layout for albums
# - TranscribeAudio: Transcribe audio memories
# - GenerateCoverImage: Generate album cover images
