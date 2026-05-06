# -*- coding: utf-8 -*-
"""FastAPI app for modular AI service."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_backend.ai_service.routers.bootstrap import router as bootstrap_router
from ai_backend.ai_service.routers.invoke import router as invoke_router
from ai_backend.ai_service.routers.memory import router as memory_router
from ai_backend.ai_service.routers.persona import router as persona_router
from ai_backend.ai_service.routers.players import router as players_router
from ai_backend.ai_service.services.container import build_container


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

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "ai_service"}

    app.include_router(bootstrap_router)
    app.include_router(invoke_router)
    app.include_router(players_router)
    app.include_router(memory_router)
    app.include_router(persona_router)
    return app


app = create_app()
