# -*- coding: utf-8 -*-
"""Memory context service for each AI player."""

from __future__ import annotations

from time import time

from ai_backend.ai_service.domain.models import (
    AgentMemoryItem,
    AgentMemoryState,
    AppendMemoryEventRequest,
    BroadcastGameEventResponse,
    EventType,
    InitMemoryRequest,
    InitMemoryResponse,
    SuspicionScore,
)
from ai_backend.ai_service.repositories.memory_repo import MemoryRepository


class MemoryService:
    """Maintain per-player memory and suspicion scores."""

    def __init__(self, repo: MemoryRepository, max_window: int = 60):
        self.repo = repo
        self.max_window = max_window

    def initialize(self, request: InitMemoryRequest) -> InitMemoryResponse:
        states = self.repo.initialize_states(request.game_id, request.players)
        return InitMemoryResponse(
            gameId=request.game_id,
            initialized=[s.ai_id for s in states],
            asyncMode=request.async_mode,
        )

    def _load_or_create_state(self, game_id: str, ai_id: str) -> AgentMemoryState:
        state = self.repo.load_state(game_id, ai_id)
        if state is None:
            state = AgentMemoryState(gameId=game_id, aiId=ai_id)
        return state

    def get_state(self, game_id: str, ai_id: str) -> AgentMemoryState | None:
        return self.repo.load_state(game_id, ai_id)

    def get_game_states(self, game_id: str) -> dict[str, AgentMemoryState]:
        return self.repo.load_game(game_id)

    def _append_item_to_state(
        self,
        state: AgentMemoryState,
        ai_id: str,
        item: AgentMemoryItem,
    ) -> AgentMemoryState:
        state.memory_window.append(item)
        if len(state.memory_window) > self.max_window:
            state.memory_window = state.memory_window[-self.max_window :]

        if item.speaker and item.speaker != ai_id:
            state.relations[item.speaker] = "recent_interaction"

        state.updated_at = int(time() * 1000)
        self.repo.save_state(state)
        return state

    def _coerce_event_type(self, value: object) -> EventType:
        raw = str(value or "").strip().lower()
        aliases = {
            "lastwords": EventType.LAST_WORDS,
            "last_words": EventType.LAST_WORDS,
            "last-words": EventType.LAST_WORDS,
            "遗言": EventType.LAST_WORDS,
        }
        if raw in aliases:
            return aliases[raw]
        for item in EventType:
            if item.value.lower() == raw:
                return item
        return EventType.SYSTEM

    def _coerce_event_targets(self, raw_event: dict) -> list[str]:
        raw_targets = raw_event.get("targets")
        if isinstance(raw_targets, list):
            return [str(item) for item in raw_targets if str(item).strip()]

        target = raw_event.get("target") or raw_event.get("voteTarget") or raw_event.get("skillTarget")
        if target:
            return [str(target)]
        return []

    def _event_signature(self, item: AgentMemoryItem) -> tuple[object, ...]:
        return (
            item.day,
            item.stage,
            item.event_type.value,
            item.speaker,
            item.content,
            tuple(item.targets),
        )

    def _coerce_visible_event(self, raw_event: dict) -> AgentMemoryItem | None:
        if not isinstance(raw_event, dict):
            return None

        if "eventType" in raw_event and "speaker" in raw_event and "content" in raw_event:
            try:
                return AgentMemoryItem.model_validate(raw_event)
            except Exception:  # noqa: BLE001
                pass

        speaker = str(
            raw_event.get("speaker")
            or raw_event.get("player")
            or raw_event.get("actor")
            or raw_event.get("from")
            or "system"
        )
        content = str(
            raw_event.get("content")
            or raw_event.get("text")
            or raw_event.get("message")
            or raw_event.get("summary")
            or raw_event.get("action")
            or ""
        ).strip()
        if not content:
            return None

        event_type = self._coerce_event_type(
            raw_event.get("eventType")
            or raw_event.get("type")
            or raw_event.get("kind")
            or raw_event.get("actionType")
            or "system"
        )
        timestamp = raw_event.get("timestamp")
        try:
            timestamp_value = int(timestamp) if timestamp is not None else int(time() * 1000)
        except (TypeError, ValueError):
            timestamp_value = int(time() * 1000)

        return AgentMemoryItem(
            eventId=str(raw_event.get("eventId") or raw_event.get("id") or ""),
            day=int(raw_event.get("day") or 0),
            stage=int(raw_event.get("stage") or 0),
            eventType=event_type,
            speaker=speaker,
            content=content,
            weight=float(raw_event.get("weight") or 1.0),
            timestamp=timestamp_value,
            targets=self._coerce_event_targets(raw_event),
        )

    def ingest_visible_events(
        self,
        game_id: str,
        ai_id: str,
        visible_events: list[dict],
        candidate_targets: list[str] | None = None,
    ) -> AgentMemoryState:
        state = self._load_or_create_state(game_id, ai_id)
        existing = {self._event_signature(item) for item in state.memory_window}
        appended = False

        for raw_event in visible_events:
            item = self._coerce_visible_event(raw_event)
            if item is None:
                continue

            signature = self._event_signature(item)
            if signature in existing:
                continue

            state = self._append_item_to_state(state, ai_id, item)
            existing.add(signature)
            appended = True

        if appended and candidate_targets:
            state = self.recompute_suspicion(game_id, ai_id, candidate_targets)
        return state

    def get_seer_checked_targets(self, game_id: str, ai_id: str) -> list[str]:
        state = self.repo.load_state(game_id, ai_id)
        if state is None:
            return []

        seen: set[str] = set()
        checked: list[str] = []
        for item in state.last_decisions:
            night_action = item.get("nightAction")
            if isinstance(night_action, dict):
                inspect_target = night_action.get("inspectTarget")
                if isinstance(inspect_target, str) and inspect_target and inspect_target not in seen:
                    seen.add(inspect_target)
                    checked.append(inspect_target)

            skill_type = str(item.get("skillType") or "").strip().lower()
            skill_target = item.get("skillTarget")
            if skill_type in {"inspect", "check", "investigate"} and isinstance(skill_target, str):
                if skill_target and skill_target not in seen:
                    seen.add(skill_target)
                    checked.append(skill_target)

        return checked

    def record_decision(self, game_id: str, ai_id: str, stage: str, decision: dict) -> AgentMemoryState:
        state = self._load_or_create_state(game_id, ai_id)
        state.last_decisions.append(
            {
                "stage": stage,
                "timestamp": int(time() * 1000),
                **decision,
            }
        )
        if len(state.last_decisions) > 20:
            state.last_decisions = state.last_decisions[-20:]

        state.updated_at = int(time() * 1000)
        self.repo.save_state(state)
        return state

    def append_event(self, request: AppendMemoryEventRequest) -> AgentMemoryState:
        state = self._load_or_create_state(request.game_id, request.ai_id)
        return self._append_item_to_state(state, request.ai_id, request.event)

    def broadcast_event(
        self,
        game_id: str,
        ai_ids: list[str],
        event: AgentMemoryItem,
        candidate_targets: list[str] | None = None,
        async_mode: bool = True,
    ) -> BroadcastGameEventResponse:
        states: dict[str, AgentMemoryState] = {}
        signature = self._event_signature(event)

        for ai_id in ai_ids:
            state = self._load_or_create_state(game_id, ai_id)
            existing = {self._event_signature(item) for item in state.memory_window}
            if signature not in existing:
                state = self._append_item_to_state(state, ai_id, event.model_copy(deep=True))
            states[ai_id] = state

        return BroadcastGameEventResponse(
            gameId=game_id,
            event=event,
            appliedAiIds=ai_ids,
            states=states,
            asyncMode=async_mode,
        )

    def recompute_suspicion(self, game_id: str, ai_id: str, candidate_targets: list[str]) -> AgentMemoryState:
        state = self._load_or_create_state(game_id, ai_id)

        keywords_suspicious = ("可疑", "怀疑", "狼人", "suspicious", "wolf")
        keywords_trust = ("好人", "金水", "信任", "trusted", "good")

        score_map: dict[str, float] = {t: 50.0 for t in candidate_targets}
        reason_map: dict[str, list[str]] = {t: [] for t in candidate_targets}

        for item in state.memory_window:
            text = item.content.lower()
            for target in candidate_targets:
                target_lower = target.lower()
                if target_lower not in text and target not in item.targets:
                    continue

                if item.event_type.value == "vote":
                    score_map[target] += 12.0 * item.weight
                    reason_map[target].append("recent_vote_focus")

                if any(k in text for k in keywords_suspicious):
                    score_map[target] += 8.0 * item.weight
                    reason_map[target].append("suspicious_language")

                if any(k in text for k in keywords_trust):
                    score_map[target] -= 6.0 * item.weight
                    reason_map[target].append("trust_signal")

        state.suspicion_scores = {}
        for target in candidate_targets:
            final_score = max(0.0, min(100.0, round(score_map[target], 2)))
            state.suspicion_scores[target] = SuspicionScore(
                target=target,
                score=final_score,
                reasons=reason_map[target][:5],
                updatedAt=int(time() * 1000),
            )

        state.updated_at = int(time() * 1000)
        self.repo.save_state(state)
        return state
