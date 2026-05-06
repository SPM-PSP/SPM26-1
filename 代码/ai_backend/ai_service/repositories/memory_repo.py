# -*- coding: utf-8 -*-
"""Abstract repository for agent memory persistence."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ai_backend.ai_service.domain.models import AgentMemoryState


class MemoryRepository(ABC):
    """Persistence contract for AI memory states."""

    @abstractmethod
    def save_state(self, state: AgentMemoryState) -> None:
        """Save one AI memory state."""

    @abstractmethod
    def load_state(self, game_id: str, ai_id: str) -> AgentMemoryState | None:
        """Load one AI memory state."""

    @abstractmethod
    def load_game(self, game_id: str) -> dict[str, AgentMemoryState]:
        """Load all AI memory states for a game."""

    @abstractmethod
    def initialize_states(self, game_id: str, ai_ids: list[str]) -> list[AgentMemoryState]:
        """Create empty states for a set of AI ids if missing."""

