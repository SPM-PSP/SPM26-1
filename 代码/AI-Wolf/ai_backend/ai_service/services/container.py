# -*- coding: utf-8 -*-
"""Service container wiring for AI service."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ai_backend.ai_service.repositories.file_memory_repo import FileMemoryRepository
from ai_backend.ai_service.services.bootstrap_service import BootstrapService
from ai_backend.ai_service.services.context_assembler import ContextAssembler
from ai_backend.ai_service.services.invoke_service import InvokeService
from ai_backend.ai_service.services.llm_gateway import LLMGateway
from ai_backend.ai_service.services.memory_service import MemoryService
from ai_backend.ai_service.services.persona_service import PersonaService
from ai_backend.ai_service.services.player_factory import PlayerFactoryService
from ai_backend.ai_service.services.werewolf_team_service import WerewolfTeamService

try:
    from ai_backend.config import config
except Exception:  # noqa: BLE001
    from config import config  # type: ignore


@dataclass
class ServiceContainer:
    """All runtime services."""

    player_factory: PlayerFactoryService
    persona_service: PersonaService
    memory_service: MemoryService
    context_assembler: ContextAssembler
    bootstrap_service: BootstrapService
    invoke_service: InvokeService
    werewolf_team_service: WerewolfTeamService


def build_container() -> ServiceContainer:
    """Create default service graph."""

    memory_root = Path(config.root_dir) / "data" / "ai_service_memory"
    memory_repo = FileMemoryRepository(memory_root)

    player_factory = PlayerFactoryService()
    persona_service = PersonaService()
    memory_service = MemoryService(memory_repo)
    context_assembler = ContextAssembler()
    bootstrap_service = BootstrapService(player_factory, memory_service, persona_service)
    llm_gateway = LLMGateway()
    invoke_service = InvokeService(llm_gateway, memory_service)
    werewolf_team_service = WerewolfTeamService(player_factory, invoke_service, memory_service)

    return ServiceContainer(
        player_factory=player_factory,
        persona_service=persona_service,
        memory_service=memory_service,
        context_assembler=context_assembler,
        bootstrap_service=bootstrap_service,
        invoke_service=invoke_service,
        werewolf_team_service=werewolf_team_service,
    )
