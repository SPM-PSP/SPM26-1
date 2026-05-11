# -*- coding: utf-8 -*-
"""Persona policy service."""

from __future__ import annotations

from threading import Lock

from ai_backend.ai_service.domain.enums import PersonaType
from ai_backend.ai_service.domain.models import (
    AssignPersonaRequest,
    AssignPersonaResponse,
    PersonaAssignment,
    PersonaPolicy,
)


class PersonaService:
    """Assign and query persona policies per AI player."""

    DEFAULT_POLICIES: dict[PersonaType, PersonaPolicy] = {
        PersonaType.AGGRESSIVE: PersonaPolicy(
            persona=PersonaType.AGGRESSIVE,
            speechRisk=0.85,
            voteVolatility=0.70,
            followGroup=0.25,
        ),
        PersonaType.CONSERVATIVE: PersonaPolicy(
            persona=PersonaType.CONSERVATIVE,
            speechRisk=0.30,
            voteVolatility=0.35,
            followGroup=0.70,
        ),
        PersonaType.LOGICAL: PersonaPolicy(
            persona=PersonaType.LOGICAL,
            speechRisk=0.50,
            voteVolatility=0.40,
            followGroup=0.45,
        ),
    }

    def __init__(self):
        self._game_assignments: dict[str, dict[str, PersonaType]] = {}
        self._lock = Lock()

    def assign(self, request: AssignPersonaRequest) -> AssignPersonaResponse:
        with self._lock:
            game_map = self._game_assignments.setdefault(request.game_id, {})
            for item in request.assignments:
                game_map[item.ai_id] = item.persona

            assignments = [
                PersonaAssignment(aiId=ai_id, persona=persona)
                for ai_id, persona in sorted(game_map.items(), key=lambda x: x[0])
            ]

        policies = {p.value: self.DEFAULT_POLICIES[p] for p in PersonaType}
        return AssignPersonaResponse(
            gameId=request.game_id,
            assignments=assignments,
            policies=policies,
        )

    def get_persona(self, game_id: str, ai_id: str) -> PersonaType | None:
        with self._lock:
            return self._game_assignments.get(game_id, {}).get(ai_id)

    def get_assignments(self, game_id: str) -> list[PersonaAssignment]:
        with self._lock:
            game_map = self._game_assignments.get(game_id, {})
            return [
                PersonaAssignment(aiId=ai_id, persona=persona)
                for ai_id, persona in sorted(game_map.items(), key=lambda x: x[0])
            ]

    def auto_assign_round_robin(self, game_id: str, ai_ids: list[str]) -> list[PersonaAssignment]:
        personas = [
            PersonaType.AGGRESSIVE,
            PersonaType.CONSERVATIVE,
            PersonaType.LOGICAL,
        ]
        assignments = [
            PersonaAssignment(aiId=ai_id, persona=personas[idx % len(personas)])
            for idx, ai_id in enumerate(ai_ids)
        ]
        req = AssignPersonaRequest(gameId=game_id, assignments=assignments)
        self.assign(req)
        return assignments

