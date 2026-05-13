# -*- coding: utf-8 -*-
"""Werewolf team coordination APIs."""

from fastapi import APIRouter, Depends, HTTPException

from ai_backend.ai_service.domain.models import (
    BaseApiResponse,
    WerewolfNightConsensusRequest,
)
from ai_backend.ai_service.routers.deps import get_container
from ai_backend.ai_service.services.container import ServiceContainer

router = APIRouter(prefix="/internal/ai/werewolf", tags=["Werewolf Team"])


@router.post("/night-consensus", response_model=BaseApiResponse)
async def build_werewolf_night_consensus(
    request: WerewolfNightConsensusRequest,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    try:
        result = await container.werewolf_team_service.build_night_consensus(request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return BaseApiResponse(data=result.model_dump(by_alias=True))
