# -*- coding: utf-8 -*-
"""Concrete LLM invoke API."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from ai_backend.ai_service.domain.models import AgentInvokeRequest, BaseApiResponse
from ai_backend.ai_service.routers.deps import get_container
from ai_backend.ai_service.services.container import ServiceContainer

router = APIRouter(prefix="/internal/ai/agent", tags=["Agent Invoke"])


def _hydrate_request_context(
    request: AgentInvokeRequest,
    container: ServiceContainer,
) -> AgentInvokeRequest:
    updates: dict[str, object] = {}

    if request.llm is None:
        bound_llm = container.player_factory.get_llm_config(request.game_id, request.ai_id)
        if bound_llm is None:
            raise HTTPException(
                status_code=404,
                detail="No bound LLM config found for this AI player; generate or bootstrap players first",
            )
        updates["llm"] = bound_llm

    profile = container.player_factory.get_player(request.game_id, request.ai_id)
    if profile is not None:
        if request.persona is None:
            updates["persona"] = profile.persona
        if request.role is None and profile.role:
            updates["role"] = profile.role
        if request.role is not None:
            container.player_factory.set_player_role(request.game_id, request.ai_id, request.role)

    if not updates:
        return request
    return request.model_copy(update=updates)


async def _run_invoke_and_maybe_callback(
    req: AgentInvokeRequest,
    container: ServiceContainer,
) -> None:
    result = await container.invoke_service.invoke_async(req)
    if req.callback_url:
        try:
            await container.invoke_service.callback(req.callback_url, result)
        except Exception:
            return


@router.post("/invoke", response_model=BaseApiResponse)
async def invoke_agent(
    request: AgentInvokeRequest,
    background_tasks: BackgroundTasks,
    container: ServiceContainer = Depends(get_container),
) -> BaseApiResponse:
    request = _hydrate_request_context(request, container)

    if request.async_mode:
        background_tasks.add_task(_run_invoke_and_maybe_callback, request, container)
        return BaseApiResponse(
            data={
                "requestId": request.request_id,
                "accepted": True,
                "asyncMode": True,
                "callbackUrl": request.callback_url,
            }
        )

    result = await container.invoke_service.invoke_async(request)
    if request.callback_url:
        background_tasks.add_task(container.invoke_service.callback, request.callback_url, result)
    return BaseApiResponse(data=result.model_dump(by_alias=True))
