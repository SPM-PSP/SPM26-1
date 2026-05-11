# -*- coding: utf-8 -*-
"""File-based memory repository (MVP, easy for local testing)."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from time import time

from ai_backend.ai_service.domain.models import AgentMemoryState
from ai_backend.ai_service.repositories.memory_repo import MemoryRepository


class FileMemoryRepository(MemoryRepository):
    """Persist per-game memory states in JSON files."""

    def __init__(self, root_dir: str | Path):
        self.root_dir = Path(root_dir)
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _game_path(self, game_id: str) -> Path:
        return self.root_dir / f"{game_id}.json"

    def _read_game_raw(self, game_id: str) -> dict:
        game_path = self._game_path(game_id)
        if not game_path.exists():
            return {"gameId": game_id, "updatedAt": int(time() * 1000), "states": {}}
        try:
            return json.loads(game_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {"gameId": game_id, "updatedAt": int(time() * 1000), "states": {}}

    def _write_game_raw(self, game_id: str, raw: dict) -> None:
        game_path = self._game_path(game_id)
        raw["updatedAt"] = int(time() * 1000)
        game_path.write_text(
            json.dumps(raw, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def save_state(self, state: AgentMemoryState) -> None:
        with self._lock:
            raw = self._read_game_raw(state.game_id)
            states = raw.setdefault("states", {})
            states[state.ai_id] = state.model_dump(by_alias=True)
            self._write_game_raw(state.game_id, raw)

    def load_state(self, game_id: str, ai_id: str) -> AgentMemoryState | None:
        with self._lock:
            raw = self._read_game_raw(game_id)
            states = raw.get("states", {})
            item = states.get(ai_id)
            if not item:
                return None
            return AgentMemoryState.model_validate(item)

    def load_game(self, game_id: str) -> dict[str, AgentMemoryState]:
        with self._lock:
            raw = self._read_game_raw(game_id)
            states = raw.get("states", {})
            return {
                ai_id: AgentMemoryState.model_validate(state_raw)
                for ai_id, state_raw in states.items()
            }

    def initialize_states(self, game_id: str, ai_ids: list[str]) -> list[AgentMemoryState]:
        initialized: list[AgentMemoryState] = []
        with self._lock:
            raw = self._read_game_raw(game_id)
            states = raw.setdefault("states", {})
            for ai_id in ai_ids:
                if ai_id in states:
                    initialized.append(AgentMemoryState.model_validate(states[ai_id]))
                    continue
                state = AgentMemoryState(gameId=game_id, aiId=ai_id)
                states[ai_id] = state.model_dump(by_alias=True)
                initialized.append(state)
            self._write_game_raw(game_id, raw)
        return initialized

