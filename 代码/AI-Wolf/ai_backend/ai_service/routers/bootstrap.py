# -*- coding: utf-8 -*-
"""One-shot bootstrap API."""

from fastapi import APIRouter, BackgroundTasks, Depends

from ai_backend.ai_service.domain.models import BaseApiResponse, BootstrapRequest
from ai_backend.ai_service.routers.deps import get_container
from ai_backend.ai_service.services.container import ServiceContainer

router = APIRouter(prefix="/internal/ai", tags=["Bootstrap"])


@router.post("/bootstrap", response_model=BaseApiResponse)
async def bootstrap(
    request: BootstrapRequest,
    background_tasks: BackgroundTasks,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    result = container.bootstrap_service.bootstrap(request)
    if request.async_mode:
        # 异步预热一次嫌疑度，确保首次调用时结构完整
        ai_ids = [p.ai_id for p in result.players]
        for ai_id in ai_ids:
            background_tasks.add_task(
                container.memory_service.recompute_suspicion,
                request.game_id,
                ai_id,
                [x for x in ai_ids if x != ai_id],
            )
    return BaseApiResponse(data=result.model_dump(by_alias=True))

