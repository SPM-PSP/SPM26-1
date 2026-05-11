# -*- coding: utf-8 -*-
"""Assemble structured context for downstream AI decision endpoints."""

from __future__ import annotations

from ai_backend.ai_service.domain.models import AgentMemoryState, AgentProfile, PersonaPolicy


class ContextAssembler:
    """Build standardized AI context object."""

    def build_context(
        self,
        profile: AgentProfile,
        memory_state: AgentMemoryState,
        persona_policy: PersonaPolicy,
        alive_players: list[str],
        private_vision: dict,
        current_stage: int,
    ) -> dict:
        return {
            "self": profile.model_dump(by_alias=True),
            "alivePlayers": alive_players,
            "privateVision": private_vision,
            "memoryWindow": [item.model_dump(by_alias=True) for item in memory_state.memory_window],
            "longSummary": memory_state.long_summary,
            "suspicionScores": {
                k: v.model_dump(by_alias=True) for k, v in memory_state.suspicion_scores.items()
            },
            "personaPolicy": persona_policy.model_dump(by_alias=True),
            "currentStage": current_stage,
        }

