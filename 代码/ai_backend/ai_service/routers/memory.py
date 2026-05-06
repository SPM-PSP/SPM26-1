# -*- coding: utf-8 -*-
"""Memory APIs."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from ai_backend.ai_service.domain.models import (
    AppendMemoryEventRequest,
    BaseApiResponse,
    InitMemoryRequest,
)
from ai_backend.ai_service.routers.deps import get_container
from ai_backend.ai_service.services.container import ServiceContainer

router = APIRouter(prefix="/internal/ai/memory", tags=["Memory"])


@router.post("/init", response_model=BaseApiResponse)
async def init_memory(
    request: InitMemoryRequest,
    background_tasks: BackgroundTasks,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    result = container.memory_service.initialize(request)
    if request.async_mode:
        for ai_id in request.players:
            background_tasks.add_task(
                container.memory_service.recompute_suspicion,
                request.game_id,
                ai_id,
                [p for p in request.players if p != ai_id],
            )
    return BaseApiResponse(data=result.model_dump(by_alias=True))


@router.post("/event", response_model=BaseApiResponse)
async def append_event(
    request: AppendMemoryEventRequest,
    background_tasks: BackgroundTasks,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    state = container.memory_service.append_event(request)
    if request.candidate_targets:
        if request.async_mode:
            background_tasks.add_task(
                container.memory_service.recompute_suspicion,
                request.game_id,
                request.ai_id,
                request.candidate_targets,
            )
        else:
            state = container.memory_service.recompute_suspicion(
                request.game_id,
                request.ai_id,
                request.candidate_targets,
            )
    return BaseApiResponse(data=state.model_dump(by_alias=True))


@router.get("/{game_id}/{ai_id}", response_model=BaseApiResponse)
async def get_memory_state(
    game_id: str,
    ai_id: str,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    state = container.memory_service.get_state(game_id, ai_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Memory state not found")
    return BaseApiResponse(data=state.model_dump(by_alias=True))


@router.get("/{game_id}", response_model=BaseApiResponse)
async def get_game_memory(
    game_id: str,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    states = container.memory_service.get_game_states(game_id)
    return BaseApiResponse(
        data={
            "gameId": game_id,
            "states": {
                ai_id: state.model_dump(by_alias=True)
                for ai_id, state in states.items()
            },
        }
    )

