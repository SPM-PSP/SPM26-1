# -*- coding: utf-8 -*-
"""FastAPI app for modular AI service."""

from __future__ import annotations

import json
import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from ai_backend.ai_service.routers.bootstrap import router as bootstrap_router
from ai_backend.ai_service.routers.game_events import router as game_events_router
from ai_backend.ai_service.routers.invoke import router as invoke_router
from ai_backend.ai_service.routers.memory import router as memory_router
from ai_backend.ai_service.routers.persona import router as persona_router
from ai_backend.ai_service.routers.players import router as players_router
from ai_backend.ai_service.routers.werewolf import router as werewolf_router
from ai_backend.ai_service.services.container import build_container

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="WolfMind AI Service",
        version="0.1.0",
        description="Modular async APIs for AI player generation, memory, and persona.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.container = build_container()

    @app.exception_handler(RequestValidationError)
    async def log_request_validation_error(
        request: Request,
        exc: RequestValidationError,
    ):
        raw_body = exc.body
        if isinstance(raw_body, (dict, list)):
            body_repr = json.dumps(raw_body, ensure_ascii=False)
        elif raw_body is None:
            body_repr = "<empty>"
        else:
            body_repr = str(raw_body)

        client_host = request.client.host if request.client else "unknown"
        logger.warning(
            "422 validation error: method=%s path=%s client=%s errors=%s body=%s",
            request.method,
            request.url.path,
            client_host,
            json.dumps(exc.errors(), ensure_ascii=False),
            body_repr,
        )
        return await request_validation_exception_handler(request, exc)

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "ai_service"}

    app.include_router(bootstrap_router)
    app.include_router(game_events_router)
    app.include_router(invoke_router)
    app.include_router(werewolf_router)
    app.include_router(players_router)
    app.include_router(memory_router)
    app.include_router(persona_router)
    return app


app = create_app()
