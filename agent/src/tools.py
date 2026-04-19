"""Runtime tools used by the LangGraph agent."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import httpx
from langchain_core.tools import BaseTool, tool
from pydantic import BaseModel, Field

from src.config import get_settings
from src.types import AgentState
from src.utils import log_debug


def _is_uuid(value: str | None) -> bool:
    if not value:
        return False
    try:
        UUID(value)
        return True
    except ValueError:
        return False


def _context_value(state: AgentState, *keys: str) -> str | None:
    if not state.context:
        return None
    for key in keys:
        raw = state.context.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


def _resolve_created_by(state: AgentState, provided: str | None) -> str | None:
    candidate = (
        provided
        or _context_value(state, "createdBy", "created_by", "userId", "user_id")
        or (state.metadata.user_id if state.metadata else None)
    )
    return candidate if _is_uuid(candidate) else None


def _resolve_group_id(state: AgentState, provided: str | None) -> str | None:
    candidate = provided or _context_value(state, "groupId", "group_id")
    return candidate if _is_uuid(candidate) else None


def _auth_header(state: AgentState) -> str | None:
    runtime_token = _context_value(state, "api_token", "auth_token", "access_token")
    settings = get_settings()
    token = runtime_token or settings.agent_api_bearer_token
    if not token:
        return None
    if token.lower().startswith("bearer "):
        return token
    return f"Bearer {token}"


async def _request_json(
    *,
    state: AgentState,
    method: str,
    path: str,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> Any:
    settings = get_settings()
    base_url = settings.agent_api_base_url.rstrip("/")
    url = f"{base_url}{path}"

    headers: dict[str, str] = {"Content-Type": "application/json"}
    auth = _auth_header(state)
    if auth:
        headers["Authorization"] = auth

    timeout = httpx.Timeout(settings.agent_api_timeout_seconds)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.request(
            method=method,
            url=url,
            params=params,
            json=body,
            headers=headers,
        )

    if response.status_code >= 400:
        detail = response.text.strip()
        raise RuntimeError(
            f"API {method} {path} failed with {response.status_code}: {detail}"
        )

    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        return response.json()
    return {"raw": response.text}


class ListEventsInput(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    category: str | None = Field(default=None)
    start_date: str | None = Field(default=None, description="ISO date/time")
    end_date: str | None = Field(default=None, description="ISO date/time")


class GetUserProfileInput(BaseModel):
    user_id: str = Field(description="UUID del usuario")


class GetGroupMembersInput(BaseModel):
    group_id: str = Field(description="UUID del grupo")


class GetGroupDatesInput(BaseModel):
    group_id: str = Field(description="UUID del grupo")


class CreateDateInput(BaseModel):
    title: str = Field(description="Titulo de la cita")
    description: str | None = Field(default=None)
    starts_at: str = Field(description="Inicio en formato ISO 8601")
    ends_at: str | None = Field(default=None, description="Fin en formato ISO 8601")
    created_by: str | None = Field(default=None, description="UUID del creador")
    group_id: str | None = Field(default=None, description="UUID del grupo")
    completed: bool = Field(default=False)
    frequency_id: str | None = Field(default=None, description="UUID de frecuencia")


def build_date_planning_tools(state: AgentState) -> list[BaseTool]:
    """Create LangChain tools with access to current runtime state/context."""

    @tool(args_schema=ListEventsInput)
    async def list_available_events(
        page: int = 1,
        page_size: int = 20,
        category: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> str:
        """Lista eventos disponibles desde /events para elegir opciones de cita."""
        params: dict[str, Any] = {
            "page": str(page),
            "pageSize": str(page_size),
        }
        if category:
            params["category"] = category
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date

        payload = await _request_json(
            state=state,
            method="GET",
            path="/events",
            params=params,
        )
        return json.dumps(payload, ensure_ascii=False)

    @tool(args_schema=GetUserProfileInput)
    async def get_user_profile(user_id: str) -> str:
        """Obtiene perfil e intereses de un usuario desde /users/{id}."""
        if not _is_uuid(user_id):
            return (
                "No pude consultar perfil: user_id no es UUID valido. "
                "Solicita el user_id real del usuario."
            )

        payload = await _request_json(
            state=state,
            method="GET",
            path=f"/users/{user_id}",
        )
        return json.dumps(payload, ensure_ascii=False)

    @tool(args_schema=GetGroupMembersInput)
    async def get_group_members(group_id: str) -> str:
        """Obtiene owner, miembros e intereses del grupo desde /groups/{groupId}/members."""
        if not _is_uuid(group_id):
            return (
                "No pude consultar miembros: group_id no es UUID valido. "
                "Solicita el group_id real del grupo."
            )

        payload = await _request_json(
            state=state,
            method="GET",
            path=f"/groups/{group_id}/members",
        )
        return json.dumps(payload, ensure_ascii=False)

    @tool(args_schema=GetGroupDatesInput)
    async def get_group_dates(group_id: str) -> str:
        """Lista citas ya creadas del grupo para evitar superposiciones horarias."""
        if not _is_uuid(group_id):
            return (
                "No pude consultar citas del grupo: group_id no es UUID valido. "
                "Solicita el group_id real del grupo."
            )

        payload = await _request_json(
            state=state,
            method="GET",
            path=f"/dates/group/{group_id}",
        )
        return json.dumps(payload, ensure_ascii=False)

    @tool(args_schema=CreateDateInput)
    async def create_date_event(
        title: str,
        starts_at: str,
        description: str | None = None,
        ends_at: str | None = None,
        created_by: str | None = None,
        group_id: str | None = None,
        completed: bool = False,
        frequency_id: str | None = None,
    ) -> str:
        """Crea una nueva cita en /dates usando el evento elegido y el horario final."""
        resolved_created_by = _resolve_created_by(state, created_by)
        resolved_group_id = _resolve_group_id(state, group_id)

        if not resolved_created_by:
            return (
                "No pude crear la cita: falta createdBy (UUID). "
                "Pedile al usuario su user_id real o enviarlo en context.createdBy."
            )

        if not resolved_group_id:
            return (
                "No pude crear la cita: falta groupId (UUID). "
                "Pedile al usuario su group_id o enviarlo en context.groupId."
            )

        payload: dict[str, Any] = {
            "title": title,
            "description": description,
            "startsAt": starts_at,
            "endsAt": ends_at,
            "completed": completed,
            "createdBy": resolved_created_by,
            "groupId": resolved_group_id,
            "frequencyId": frequency_id,
        }

        cleaned_payload = {k: v for k, v in payload.items() if v is not None}

        created = await _request_json(
            state=state,
            method="POST",
            path="/dates",
            body=cleaned_payload,
        )

        log_debug("Date created through tool", {
            "title": title,
            "groupId": resolved_group_id,
            "createdBy": resolved_created_by,
        })

        return json.dumps(created, ensure_ascii=False)

    return [
        list_available_events,
        get_user_profile,
        get_group_members,
        get_group_dates,
        create_date_event,
    ]
