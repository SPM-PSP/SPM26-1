# -*- coding: utf-8 -*-
"""Orchestrator for one-shot bootstrap of AI players/memory/persona."""

from __future__ import annotations

from ai_backend.ai_service.domain.models import (
    AssignPersonaRequest,
    BootstrapRequest,
    BootstrapResponse,
    GeneratePlayersRequest,
    InitMemoryRequest,
)
from ai_backend.ai_service.services.memory_service import MemoryService
from ai_backend.ai_service.services.persona_service import PersonaService
from ai_backend.ai_service.services.player_factory import PlayerFactoryService


class BootstrapService:
    """Compose player generation + memory init + persona assignment."""

    def __init__(
        self,
        player_factory: PlayerFactoryService,
        memory_service: MemoryService,
        persona_service: PersonaService,
    ):
        self.player_factory = player_factory
        self.memory_service = memory_service
        self.persona_service = persona_service

    def bootstrap(self, request: BootstrapRequest) -> BootstrapResponse:
        generated = self.player_factory.generate_players(
            GeneratePlayersRequest(
                gameId=request.game_id,
                roomId=request.room_id,
                aiCount=request.ai_count,
                modelPolicy=request.model_policy,
            )
        )
        ai_ids = [p.ai_id for p in generated.players]

        mem_res = self.memory_service.initialize(
            InitMemoryRequest(
                gameId=request.game_id,
                players=ai_ids,
                asyncMode=request.async_mode,
            )
        )

        if request.persona_assignments:
            assigned = self.persona_service.assign(
                AssignPersonaRequest(
                    gameId=request.game_id,
                    assignments=request.persona_assignments,
                )
            ).assignments
        else:
            assigned = self.persona_service.auto_assign_round_robin(request.game_id, ai_ids)

        for item in assigned:
            self.player_factory.set_player_persona(request.game_id, item.ai_id, item.persona)

        players = self.player_factory.get_players(request.game_id)
        return BootstrapResponse(
            gameId=request.game_id,
            roomId=request.room_id,
            players=players,
            memoryInitialized=mem_res.initialized,
            personaAssignments=assigned,
            asyncMode=request.async_mode,
        )

