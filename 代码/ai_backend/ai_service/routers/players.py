# -*- coding: utf-8 -*-
"""Player factory APIs."""

from fastapi import APIRouter, Depends, HTTPException

from ai_backend.ai_service.domain.models import (
    AssignRolesRequest,
    BaseApiResponse,
    GeneratePlayersRequest,
)
from ai_backend.ai_service.routers.deps import get_container
from ai_backend.ai_service.services.container import ServiceContainer

router = APIRouter(prefix="/internal/ai/players", tags=["AI Players"])


@router.post("/generate", response_model=BaseApiResponse)
async def generate_players(
    request: GeneratePlayersRequest,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    result = container.player_factory.generate_players(request)
    return BaseApiResponse(data=result.model_dump(by_alias=True))


@router.post("/roles/assign", response_model=BaseApiResponse)
async def assign_roles(
    request: AssignRolesRequest,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    result = container.player_factory.assign_roles(request.game_id, request.assignments)
    if not result.assignments:
        raise HTTPException(status_code=404, detail="No matching AI players found for role assignment")
    return BaseApiResponse(data=result.model_dump(by_alias=True))


@router.get("/{game_id}", response_model=BaseApiResponse)
async def get_players(
    game_id: str,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    players = container.player_factory.get_players(game_id)
    if not players:
        raise HTTPException(status_code=404, detail="No AI players found for game")
    return BaseApiResponse(
        data={
            "gameId": game_id,
            "players": [p.model_dump(by_alias=True) for p in players],
        }
    )
