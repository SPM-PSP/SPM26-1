# -*- coding: utf-8 -*-
"""Dependency helpers for FastAPI routers."""

from fastapi import Request

from ai_backend.ai_service.services.container import ServiceContainer


def get_container(request: Request) -> ServiceContainer:
    """Get service container from app state."""

    return request.app.state.container  # type: ignore[attr-defined]

