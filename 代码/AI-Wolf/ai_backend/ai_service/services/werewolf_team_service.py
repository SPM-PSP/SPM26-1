# -*- coding: utf-8 -*-
"""Helpers for all-AI werewolf team night consensus."""

from __future__ import annotations

import asyncio
from typing import Any

from ai_backend.ai_service.domain.models import (
    AgentDecision,
    AgentInvokeRequest,
    InvokeStage,
    NightActionPlan,
    WerewolfAdviceItem,
    WerewolfConsensusScore,
    WerewolfNightConsensusRequest,
    WerewolfNightConsensusResponse,
)
from ai_backend.ai_service.prompts.role_base_prompts import normalize_role_name
from ai_backend.ai_service.services.invoke_service import InvokeService
from ai_backend.ai_service.services.memory_service import MemoryService
from ai_backend.ai_service.services.player_factory import PlayerFactoryService


class WerewolfTeamService:
    """Coordinate all-AI werewolf advice collection and consensus."""

    def __init__(
        self,
        player_factory: PlayerFactoryService,
        invoke_service: InvokeService,
        memory_service: MemoryService,
    ):
        self.player_factory = player_factory
        self.invoke_service = invoke_service
        self.memory_service = memory_service

    def _dedupe_ids(self, values: list[str]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for value in values:
            normalized = str(value).strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            ordered.append(normalized)
        return ordered

    def _build_base_private_vision(
        self,
        request: WerewolfNightConsensusRequest,
        wolf_teammates: list[str],
    ) -> dict[str, Any]:
        private_vision = dict(request.private_vision or {})
        private_vision.pop("consensusTarget", None)
        private_vision.pop("forceConsensusTarget", None)
        private_vision.pop("wolfDecisionMode", None)
        private_vision["wolfTeammates"] = wolf_teammates
        return private_vision

    def _raw_wolf_teammates(self, request: WerewolfNightConsensusRequest) -> list[Any]:
        raw_value = request.private_vision.get("wolfTeammates")
        if raw_value is None:
            return []
        if isinstance(raw_value, (list, tuple, set)):
            return list(raw_value)
        return [raw_value]

    def _legal_targets(
        self,
        request: WerewolfNightConsensusRequest,
        wolf_teammates: list[str],
    ) -> list[str]:
        source = request.candidate_targets or request.alive_players
        allow_friendly_fire = bool(request.private_vision.get("allowFriendlyFire", False))
        excluded = set() if allow_friendly_fire else set(wolf_teammates)

        ordered: list[str] = []
        seen: set[str] = set()
        for item in source:
            target = str(item).strip()
            if not target or target in seen or target in excluded:
                continue
            seen.add(target)
            ordered.append(target)
        return ordered

    def _build_advice_request(
        self,
        request: WerewolfNightConsensusRequest,
        ai_id: str,
        wolf_teammates: list[str],
    ) -> AgentInvokeRequest:
        profile = self.player_factory.get_player(request.game_id, ai_id)
        if profile is None:
            raise LookupError(f"AI player not found for werewolf consensus: {ai_id}")

        normalized_role = normalize_role_name(profile.role or "werewolf")
        if normalized_role != "werewolf":
            raise ValueError(f"AI player is not a werewolf and cannot join werewolf consensus: {ai_id}")

        llm = self.player_factory.get_llm_config(request.game_id, ai_id)
        if llm is None:
            raise LookupError(f"No bound LLM config found for werewolf AI: {ai_id}")

        private_vision = self._build_base_private_vision(request, wolf_teammates)
        private_vision["wolfDecisionMode"] = "advice_only"
        private_vision["forceConsensusTarget"] = False

        return AgentInvokeRequest(
            requestId=f"{request.request_id}:{ai_id}:advice",
            gameId=request.game_id,
            aiId=ai_id,
            stage=InvokeStage.NIGHT_ACTION,
            role="werewolf",
            persona=profile.persona,
            llm=llm,
            visibleEvents=request.visible_events,
            alivePlayers=request.alive_players,
            candidateTargets=request.candidate_targets or request.alive_players,
            privateVision=private_vision,
            asyncMode=False,
        )

    @staticmethod
    def _extract_suggested_target(advice: WerewolfAdviceItem | None) -> str | None:
        if advice is None:
            return None
        return advice.suggested_target

    @staticmethod
    def _is_tie_broken_by_order(aggregate_scores: list[WerewolfConsensusScore]) -> bool:
        if len(aggregate_scores) <= 1:
            return False
        top = aggregate_scores[0]
        tied = [
            item for item in aggregate_scores
            if item.recommendation_count == top.recommendation_count
            and item.confidence_sum == top.confidence_sum
        ]
        return len(tied) > 1

    async def build_night_consensus(
        self,
        request: WerewolfNightConsensusRequest,
    ) -> WerewolfNightConsensusResponse:
        werewolf_ai_ids = self._dedupe_ids(request.werewolf_ai_ids)
        if not werewolf_ai_ids:
            raise ValueError("werewolfAiIds must contain at least one AI werewolf")

        wolf_teammates = self._dedupe_ids(
            [
                *[str(item) for item in self._raw_wolf_teammates(request)],
                *werewolf_ai_ids,
            ]
        )
        if not wolf_teammates:
            wolf_teammates = list(werewolf_ai_ids)

        legal_targets = self._legal_targets(request, wolf_teammates)
        candidate_order = {target: idx for idx, target in enumerate(legal_targets)}

        invoke_requests = [
            self._build_advice_request(request, ai_id, wolf_teammates)
            for ai_id in werewolf_ai_ids
        ]
        invoke_results = await asyncio.gather(
            *(self.invoke_service.invoke_async(item) for item in invoke_requests)
        )

        advice_results: list[WerewolfAdviceItem] = []
        aggregate_map: dict[str, dict[str, Any]] = {}
        for result in invoke_results:
            suggested_target = None
            if result.decision.night_action is not None:
                suggested_target = result.decision.night_action.kill_target
            if suggested_target not in legal_targets:
                suggested_target = None

            advice_item = WerewolfAdviceItem(
                aiId=result.ai_id,
                suggestedTarget=suggested_target,
                confidence=result.decision.confidence,
                explain=list(result.decision.explain or []),
                speechText=result.decision.speech_text or "",
                suspicionScores=result.suspicion_scores,
                fallbackUsed=result.fallback_used,
                errorCode=result.error_code,
                latencyMs=result.latency_ms,
            )
            advice_results.append(advice_item)

            target = self._extract_suggested_target(advice_item)
            if target is None:
                continue

            bucket = aggregate_map.setdefault(
                target,
                {
                    "recommendationCount": 0,
                    "confidenceSum": 0.0,
                    "recommenders": [],
                },
            )
            bucket["recommendationCount"] += 1
            bucket["confidenceSum"] += float(advice_item.confidence or 0.0)
            bucket["recommenders"].append(advice_item.ai_id)

        aggregate_scores = [
            WerewolfConsensusScore(
                target=target,
                recommendationCount=data["recommendationCount"],
                confidenceSum=round(float(data["confidenceSum"]), 4),
                score=round(float(data["recommendationCount"]) * 100.0 + float(data["confidenceSum"]), 4),
                recommenders=list(data["recommenders"]),
            )
            for target, data in aggregate_map.items()
        ]
        aggregate_scores.sort(
            key=lambda item: (
                -item.recommendation_count,
                -item.confidence_sum,
                candidate_order.get(item.target, len(candidate_order)),
                item.target,
            )
        )

        consensus_target = aggregate_scores[0].target if aggregate_scores else None
        if consensus_target is None and legal_targets:
            consensus_target = legal_targets[0]

        shared_private_vision = self._build_base_private_vision(request, wolf_teammates)
        shared_private_vision["consensusTarget"] = consensus_target
        shared_private_vision["forceConsensusTarget"] = bool(consensus_target)
        shared_private_vision["wolfDecisionMode"] = "auto_execute"

        private_vision_by_ai_id = {
            ai_id: dict(shared_private_vision)
            for ai_id in werewolf_ai_ids
        }

        top_score = aggregate_scores[0] if aggregate_scores else None
        tie_broken_by_order = self._is_tie_broken_by_order(aggregate_scores)
        execution_confidence = 0.0
        if top_score is not None and top_score.recommendation_count > 0:
            execution_confidence = round(
                top_score.confidence_sum / float(top_score.recommendation_count),
                4,
            )

        execution_explain = ["werewolf_team_consensus_selected"]
        if tie_broken_by_order:
            execution_explain.append("werewolf_team_consensus_tie_broken_by_candidate_order")
        if consensus_target is None:
            execution_explain = ["werewolf_team_consensus_no_legal_target"]

        execution_decision = AgentDecision(
            actionType="night_action",
            speechText="",
            voteTarget=None,
            skillType="kill" if consensus_target else "pass",
            skillTarget=consensus_target,
            nightAction=NightActionPlan(
                killTarget=consensus_target,
                passReason=None if consensus_target else "no_legal_kill_target",
            ),
            confidence=execution_confidence,
            explain=execution_explain,
        )

        for ai_id in werewolf_ai_ids:
            self.memory_service.record_decision(
                request.game_id,
                ai_id,
                "night_consensus",
                {
                    **execution_decision.model_dump(by_alias=True),
                    "consensusTarget": consensus_target,
                    "sharedPrivateVision": private_vision_by_ai_id[ai_id],
                },
            )

        return WerewolfNightConsensusResponse(
            requestId=request.request_id,
            gameId=request.game_id,
            werewolfAiIds=werewolf_ai_ids,
            legalTargets=legal_targets,
            adviceResults=advice_results,
            aggregateScores=aggregate_scores,
            consensusTarget=consensus_target,
            finalKillTarget=consensus_target,
            executionDecision=execution_decision,
            sharedPrivateVision=shared_private_vision,
            privateVisionByAiId=private_vision_by_ai_id,
            consensusRecordedAiIds=werewolf_ai_ids,
        )
