# -*- coding: utf-8 -*-
"""Public game event broadcast APIs."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from ai_backend.ai_service.domain.models import (
    BaseApiResponse,
    BroadcastGameEventRequest,
)
from ai_backend.ai_service.routers.deps import get_container
from ai_backend.ai_service.services.container import ServiceContainer

router = APIRouter(prefix="/internal/ai/game/events", tags=["Game Events"])


@router.post("/broadcast", response_model=BaseApiResponse)
async def broadcast_game_event(
    request: BroadcastGameEventRequest,
    background_tasks: BackgroundTasks,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    game_players = container.player_factory.get_players(request.game_id)
    known_ai_ids = [profile.ai_id for profile in game_players]

    if request.ai_ids is not None:
        target_ai_ids = [ai_id for ai_id in request.ai_ids if ai_id in known_ai_ids]
    else:
        target_ai_ids = known_ai_ids

    if not target_ai_ids:
        raise HTTPException(status_code=404, detail="No AI players found for this game")

    result = container.memory_service.broadcast_event(
        request.game_id,
        target_ai_ids,
        request.event,
        request.candidate_targets,
        request.async_mode,
    )

    if request.candidate_targets:
        if request.async_mode:
            for ai_id in target_ai_ids:
                background_tasks.add_task(
                    container.memory_service.recompute_suspicion,
                    request.game_id,
                    ai_id,
                    request.candidate_targets,
                )
        else:
            recomputed: dict[str, dict] = {}
            for ai_id in target_ai_ids:
                state = container.memory_service.recompute_suspicion(
                    request.game_id,
                    ai_id,
                    request.candidate_targets,
                )
                recomputed[ai_id] = state.model_dump(by_alias=True)
            payload = result.model_dump(by_alias=True)
            payload["states"] = recomputed
            return BaseApiResponse(data=payload)

    return BaseApiResponse(data=result.model_dump(by_alias=True))
