# -*- coding: utf-8 -*-
"""Persona policy APIs."""

from fastapi import APIRouter, Depends, HTTPException

from ai_backend.ai_service.domain.models import AssignPersonaRequest, BaseApiResponse
from ai_backend.ai_service.routers.deps import get_container
from ai_backend.ai_service.services.container import ServiceContainer

router = APIRouter(prefix="/internal/ai/persona", tags=["Persona"])


@router.post("/assign", response_model=BaseApiResponse)
async def assign_persona(
    request: AssignPersonaRequest,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    result = container.persona_service.assign(request)
    for assignment in result.assignments:
        container.player_factory.set_player_persona(
            request.game_id, assignment.ai_id, assignment.persona
        )
    return BaseApiResponse(data=result.model_dump(by_alias=True))


@router.get("/{game_id}", response_model=BaseApiResponse)
async def get_persona_assignments(
    game_id: str,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    assignments = container.persona_service.get_assignments(game_id)
    if not assignments:
        raise HTTPException(status_code=404, detail="No persona assignment found for game")
    return BaseApiResponse(
        data={
            "gameId": game_id,
            "assignments": [a.model_dump(by_alias=True) for a in assignments],
        }
    )

