# -*- coding: utf-8 -*-
"""Agent invoke service: run LLM decision + fallback + callback."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from urllib import request as urlrequest

from pydantic import ValidationError

from ai_backend.ai_service.domain.models import (
    AgentDecision,
    AgentInvokeRequest,
    AgentInvokeResult,
    InvokeStage,
    NightActionPlan,
    SuspicionScore,
)
from ai_backend.ai_service.prompts.persona_prompts import get_persona_prompt
from ai_backend.ai_service.prompts.role_base_prompts import get_role_prompt, normalize_role_name
from ai_backend.ai_service.services.llm_gateway import LLMGateway
from ai_backend.ai_service.services.memory_service import MemoryService

logger = logging.getLogger(__name__)


class InvokeService:
    """Execute concrete model invocation for one AI action."""

    def __init__(self, llm_gateway: LLMGateway, memory_service: MemoryService):
        self.llm_gateway = llm_gateway
        self.memory_service = memory_service

    def _build_night_rules(
        self,
        req: AgentInvokeRequest,
        normalized_role: str | None,
        checked_targets: list[str],
    ) -> str:
        if req.stage != InvokeStage.NIGHT_ACTION:
            return ""

        if normalized_role == "werewolf":
            return (
                "Night action rules for werewolf:\n"
                "- Use nightAction.killTarget to choose the player to eliminate.\n"
                "- Do not target wolf teammates from privateVision.wolfTeammates unless "
                "privateVision.allowFriendlyFire is true.\n"
                "- If privateVision.consensusTarget is present and legal, prefer it.\n"
                "- If privateVision.teammateMessages or privateVision.wolfChat is present, use it "
                "as coordination context, including messages from human teammates.\n"
                "- Set skillType to \"kill\" when choosing a target.\n"
            )

        if normalized_role == "seer":
            checked_text = ", ".join(checked_targets) if checked_targets else "none"
            return (
                "Night action rules for seer:\n"
                "- Use nightAction.inspectTarget to choose exactly one player to inspect.\n"
                f"- Already inspected targets from memory: {checked_text}.\n"
                "- Do not inspect the same target again if there is any unchecked legal target.\n"
                "- Set skillType to \"inspect\" when choosing a target.\n"
            )

        if normalized_role == "witch":
            return (
                "Night action rules for witch:\n"
                "- privateVision.nightDeathCandidate is the player dying tonight, if any.\n"
                "- privateVision.antidoteAvailable tells you whether the antidote is still unused.\n"
                "- privateVision.poisonAvailable tells you whether the poison is still unused.\n"
                "- You may save, poison, do both, or pass.\n"
                "- Use nightAction.saveTarget only for the nightDeathCandidate.\n"
                "- Use nightAction.poisonTarget for the poison target.\n"
                "- If you save and poison in the same night, fill both fields.\n"
                "- If you cannot or should not act, leave both fields null and explain why.\n"
            )

        if normalized_role == "villager":
            return (
                "Night action rules for villager:\n"
                "- Villagers have no night ability.\n"
                "- Return a pass decision with no target.\n"
            )

        return (
            "Night action rules:\n"
            "- Stay within the role's legal abilities.\n"
            "- If no legal night action exists, return a pass decision.\n"
        )

    def _build_special_stage_rules(
        self,
        req: AgentInvokeRequest,
        normalized_role: str | None,
    ) -> str:
        if req.stage != InvokeStage.DEATH_SHOT:
            return ""

        if normalized_role == "hunter":
            return (
                "Death shot rules for hunter:\n"
                "- This stage happens only when the hunter is being eliminated.\n"
                "- privateVision.hunterCanShoot tells you whether the shot can legally trigger.\n"
                "- If privateVision.deathReason is witch_poison, poison, or poisoned, you cannot shoot.\n"
                "- If privateVision.hunterShotUsed is true, you cannot shoot again.\n"
                "- If you can shoot, choose exactly one target from candidateTargets.\n"
                "- Set skillType to \"shoot\" and skillTarget to the chosen target.\n"
                "- If you cannot shoot, return a pass decision and explain why.\n"
            )

        return (
            "Special action rules:\n"
            "- If this role has no death-triggered action, return a pass decision.\n"
        )

    def _build_vote_rules(self, req: AgentInvokeRequest, normalized_role: str | None) -> str:
        if req.stage != InvokeStage.VOTE:
            return ""

        if normalized_role == "werewolf":
            return (
                "Vote rules for werewolf:\n"
                "- Avoid voting for players listed in privateVision.wolfTeammates.\n"
                "- Do not vote for a wolf teammate unless privateVision.allowFriendlyFire is true.\n"
                "- Choose a voteTarget from non-teammate candidateTargets whenever possible.\n"
            )

        return ""

    def _build_prompt(self, req: AgentInvokeRequest) -> list[dict[str, str]]:
        normalized_role = normalize_role_name(req.role)
        persona_prompt = get_persona_prompt(req.persona.value if req.persona else None)
        role_prompt = get_role_prompt(normalized_role)
        checked_targets = []
        if req.stage == InvokeStage.NIGHT_ACTION and normalized_role == "seer":
            checked_targets = self.memory_service.get_seer_checked_targets(req.game_id, req.ai_id)
        night_rules = self._build_night_rules(req, normalized_role, checked_targets)
        vote_rules = self._build_vote_rules(req, normalized_role)
        special_stage_rules = self._build_special_stage_rules(req, normalized_role)

        system_prompt = (
            "You are an AI player in a Werewolf-style social deduction game.\n\n"
            f"{role_prompt}\n\n"
            f"{persona_prompt}\n\n"
            "Base rules:\n"
            "- Use only information available to this player.\n"
            "- Respect privateVision if provided, but do not invent hidden information.\n"
            "- Stay consistent with your role and public incentives.\n"
            "- Keep decisions targeted and realistic for the current stage.\n\n"
            f"{night_rules}\n"
            f"{vote_rules}\n"
            f"{special_stage_rules}\n"
            "Return one JSON object only with this schema:\n"
            "{"
            "\"actionType\": string,"
            "\"speechText\": string,"
            "\"voteTarget\": string|null,"
            "\"skillType\": string|null,"
            "\"skillTarget\": string|null,"
            "\"nightAction\": {"
            "\"killTarget\": string|null,"
            "\"inspectTarget\": string|null,"
            "\"saveTarget\": string|null,"
            "\"poisonTarget\": string|null,"
            "\"passReason\": string|null"
            "}|null,"
            "\"confidence\": number,"
            "\"explain\": string[],"
            "\"suspicionScores\": [{\"target\": string, \"score\": number, \"reasons\": string[]}]"
            "}\n\n"
            "Output rules:\n"
            "- actionType must match the stage.\n"
            "- speechText should be a natural in-game utterance.\n"
            "- voteTarget and skillTarget must come from candidateTargets when candidateTargets is not empty.\n"
            "- For night_action, fill nightAction with role-legal fields only.\n"
            "- For death_shot, only hunter may return a shoot action.\n"
            "- confidence must be between 0 and 1.\n"
            "- explain should briefly justify the action."
        )
        memory_hints: dict[str, object] = {}
        if checked_targets:
            memory_hints["alreadyCheckedTargets"] = checked_targets
        user_payload = {
            "requestId": req.request_id,
            "gameId": req.game_id,
            "aiId": req.ai_id,
            "stage": req.stage.value,
            "role": normalized_role,
            "persona": req.persona.value if req.persona else None,
            "alivePlayers": req.alive_players,
            "candidateTargets": req.candidate_targets,
            "privateVision": req.private_vision,
            "visibleEvents": req.visible_events[-30:],
            "memoryHints": memory_hints,
        }
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ]

    def _legal_targets_excluding(
        self,
        req: AgentInvokeRequest,
        excluded: list[str] | None = None,
    ) -> list[str]:
        excluded_set = {x for x in (excluded or []) if x}
        return [target for target in req.candidate_targets if target not in excluded_set]

    def _normalize_night_action(
        self,
        req: AgentInvokeRequest,
        decision: AgentDecision,
    ) -> NightActionPlan:
        existing = decision.night_action or NightActionPlan()
        skill_type = (decision.skill_type or "").strip().lower()
        skill_target = decision.skill_target
        death_target = req.private_vision.get("nightDeathCandidate")

        updates: dict[str, object] = existing.model_dump(by_alias=False)
        if updates.get("kill_target") is None and skill_type in {"kill", "attack"}:
            updates["kill_target"] = skill_target
        if updates.get("inspect_target") is None and skill_type in {"inspect", "check", "investigate"}:
            updates["inspect_target"] = skill_target
        if updates.get("save_target") is None and skill_type in {"save", "heal", "antidote"}:
            updates["save_target"] = death_target if death_target else skill_target
        if updates.get("poison_target") is None and skill_type == "poison":
            updates["poison_target"] = skill_target
        if (
            updates.get("save_target") is None
            and updates.get("poison_target") is None
            and skill_type == "save_and_poison"
        ):
            updates["save_target"] = death_target
            updates["poison_target"] = skill_target

        return NightActionPlan(**updates)

    def _validate_night_action(
        self,
        req: AgentInvokeRequest,
        decision: AgentDecision,
        normalized_role: str | None,
    ) -> AgentDecision:
        night_action = self._normalize_night_action(req, decision)
        explain = list(decision.explain or [])
        default_speech = decision.speech_text or ""

        if normalized_role == "werewolf":
            wolf_teammates = req.private_vision.get("wolfTeammates") or []
            allow_friendly_fire = bool(req.private_vision.get("allowFriendlyFire", False))
            excluded = [] if allow_friendly_fire else [str(x) for x in wolf_teammates]
            legal_targets = self._legal_targets_excluding(req, excluded)
            consensus_target = req.private_vision.get("consensusTarget")
            target = night_action.kill_target
            if target not in legal_targets:
                if consensus_target in legal_targets:
                    target = str(consensus_target)
                else:
                    target = legal_targets[0] if legal_targets else None

            return decision.model_copy(
                update={
                    "action_type": "night_action",
                    "skill_type": "kill" if target else "pass",
                    "skill_target": target,
                    "vote_target": None,
                    "night_action": NightActionPlan(
                        killTarget=target,
                        passReason=None if target else "no_legal_kill_target",
                    ),
                    "speech_text": default_speech,
                    "explain": explain or ["role_legal_werewolf_night_action"],
                }
            )

        if normalized_role == "seer":
            checked_targets = self.memory_service.get_seer_checked_targets(req.game_id, req.ai_id)
            legal_targets = self._legal_targets_excluding(req, [req.ai_id, *checked_targets])
            target = night_action.inspect_target
            if target not in legal_targets:
                target = legal_targets[0] if legal_targets else None

            return decision.model_copy(
                update={
                    "action_type": "night_action",
                    "skill_type": "inspect" if target else "pass",
                    "skill_target": target,
                    "vote_target": None,
                    "night_action": NightActionPlan(
                        inspectTarget=target,
                        passReason=None if target else "no_unchecked_target_available",
                    ),
                    "speech_text": default_speech,
                    "explain": explain or ["role_legal_seer_night_action"],
                }
            )

        if normalized_role == "witch":
            death_target = req.private_vision.get("nightDeathCandidate")
            antidote_available = bool(req.private_vision.get("antidoteAvailable", False))
            poison_available = bool(req.private_vision.get("poisonAvailable", False))

            save_target = night_action.save_target if antidote_available else None
            if death_target:
                death_target = str(death_target)
            if save_target != death_target:
                save_target = death_target if save_target and antidote_available and death_target else None

            poison_target = night_action.poison_target if poison_available else None
            legal_poison_targets = self._legal_targets_excluding(req, [req.ai_id])
            if poison_target not in legal_poison_targets:
                poison_target = None

            if save_target and poison_target:
                skill_type = "save_and_poison"
                skill_target = poison_target
            elif save_target:
                skill_type = "save"
                skill_target = save_target
            elif poison_target:
                skill_type = "poison"
                skill_target = poison_target
            else:
                skill_type = "pass"
                skill_target = None

            return decision.model_copy(
                update={
                    "action_type": "night_action",
                    "skill_type": skill_type,
                    "skill_target": skill_target,
                    "vote_target": None,
                    "night_action": NightActionPlan(
                        saveTarget=save_target,
                        poisonTarget=poison_target,
                        passReason=None if (save_target or poison_target) else "no_night_item_used",
                    ),
                    "speech_text": default_speech,
                    "explain": explain or ["role_legal_witch_night_action"],
                }
            )

        return decision.model_copy(
            update={
                "action_type": "night_action",
                "skill_type": "pass",
                "skill_target": None,
                "vote_target": None,
                "night_action": NightActionPlan(passReason="role_has_no_night_action"),
                "speech_text": default_speech,
                "explain": explain or ["role_has_no_night_action"],
            }
        )

    def _validate_hunter_death_shot(
        self,
        req: AgentInvokeRequest,
        decision: AgentDecision,
        normalized_role: str | None,
    ) -> AgentDecision:
        explain = list(decision.explain or [])
        default_speech = decision.speech_text or ""

        if normalized_role != "hunter":
            return decision.model_copy(
                update={
                    "action_type": "death_shot",
                    "speech_text": default_speech,
                    "vote_target": None,
                    "skill_type": "pass",
                    "skill_target": None,
                    "night_action": None,
                    "explain": explain or ["role_has_no_death_shot_action"],
                }
            )

        death_reason = str(req.private_vision.get("deathReason") or "").strip().lower()
        hunter_can_shoot = bool(req.private_vision.get("hunterCanShoot", False))
        hunter_shot_used = bool(req.private_vision.get("hunterShotUsed", False))
        poison_block_reasons = {"witch_poison", "poison", "poisoned"}

        if death_reason in poison_block_reasons or not hunter_can_shoot or hunter_shot_used:
            reason = "hunter_shot_blocked"
            if death_reason in poison_block_reasons:
                reason = "hunter_cannot_shoot_after_poison"
            elif hunter_shot_used:
                reason = "hunter_shot_already_used"
            elif not hunter_can_shoot:
                reason = "hunter_shot_not_triggered"

            return decision.model_copy(
                update={
                    "action_type": "death_shot",
                    "speech_text": default_speech,
                    "vote_target": None,
                    "skill_type": "pass",
                    "skill_target": None,
                    "night_action": None,
                    "explain": explain or [reason],
                }
            )

        legal_targets = self._legal_targets_excluding(req, [req.ai_id])
        target = decision.skill_target
        if target not in legal_targets:
            target = decision.vote_target
        if target not in legal_targets:
            target = legal_targets[0] if legal_targets else None

        return decision.model_copy(
            update={
                "action_type": "death_shot",
                "speech_text": default_speech,
                "vote_target": None,
                "skill_type": "shoot" if target else "pass",
                "skill_target": target,
                "night_action": None,
                "explain": explain or ["role_legal_hunter_death_shot"],
            }
        )

    def _validate_decision(self, req: AgentInvokeRequest, decision: AgentDecision) -> AgentDecision:
        explain = list(decision.explain or [])
        if req.stage == InvokeStage.SPEECH:
            speech_text = decision.speech_text or "I need one more round of discussion before committing."
            return decision.model_copy(
                update={
                    "action_type": "speech",
                    "speech_text": speech_text,
                    "vote_target": None,
                    "skill_type": None,
                    "skill_target": None,
                    "night_action": None,
                    "explain": explain or ["speech_stage_response"],
                }
            )

        if req.stage == InvokeStage.VOTE:
            target = decision.vote_target
            if normalize_role_name(req.role) == "werewolf":
                wolf_teammates = [str(x) for x in (req.private_vision.get("wolfTeammates") or [])]
                allow_friendly_fire = bool(req.private_vision.get("allowFriendlyFire", False))
                legal_targets = req.candidate_targets
                if not allow_friendly_fire:
                    non_teammate_targets = self._legal_targets_excluding(req, wolf_teammates)
                    if non_teammate_targets:
                        legal_targets = non_teammate_targets
                if legal_targets and target not in legal_targets:
                    target = legal_targets[0]
            elif req.candidate_targets and target not in req.candidate_targets:
                target = req.candidate_targets[0]
            return decision.model_copy(
                update={
                    "action_type": "vote",
                    "vote_target": target,
                    "skill_type": None,
                    "skill_target": None,
                    "night_action": None,
                    "explain": explain or ["vote_stage_response"],
                }
            )

        normalized_role = normalize_role_name(req.role)
        if req.stage == InvokeStage.DEATH_SHOT:
            return self._validate_hunter_death_shot(req, decision, normalized_role)
        return self._validate_night_action(req, decision, normalized_role)

    def _fallback_result(self, req: AgentInvokeRequest, latency_ms: int, error_code: str) -> AgentInvokeResult:
        if req.stage.value == "vote":
            vote_target = req.candidate_targets[0] if req.candidate_targets else None
            if normalize_role_name(req.role) == "werewolf":
                wolf_teammates = [str(x) for x in (req.private_vision.get("wolfTeammates") or [])]
                allow_friendly_fire = bool(req.private_vision.get("allowFriendlyFire", False))
                legal_targets = req.candidate_targets
                if not allow_friendly_fire:
                    non_teammate_targets = self._legal_targets_excluding(req, wolf_teammates)
                    if non_teammate_targets:
                        legal_targets = non_teammate_targets
                vote_target = legal_targets[0] if legal_targets else None
            decision = AgentDecision(
                actionType="vote",
                speechText="I do not have enough reliable signal yet, so I will vote for the most discussable target.",
                voteTarget=vote_target,
                confidence=0.35,
                explain=["fallback_vote_due_to_timeout_or_error"],
            )
        elif req.stage.value == "night_action":
            normalized_role = normalize_role_name(req.role)
            if normalized_role == "werewolf":
                wolf_teammates = [str(x) for x in (req.private_vision.get("wolfTeammates") or [])]
                legal_targets = self._legal_targets_excluding(req, wolf_teammates)
                skill_target = legal_targets[0] if legal_targets else None
                decision = AgentDecision(
                    actionType="night_action",
                    speechText="",
                    skillType="kill" if skill_target else "pass",
                    skillTarget=skill_target,
                    nightAction=NightActionPlan(
                        killTarget=skill_target,
                        passReason=None if skill_target else "fallback_no_legal_kill_target",
                    ),
                    confidence=0.30,
                    explain=["fallback_night_action_due_to_timeout_or_error"],
                )
            elif normalized_role == "seer":
                checked_targets = self.memory_service.get_seer_checked_targets(req.game_id, req.ai_id)
                legal_targets = self._legal_targets_excluding(req, [req.ai_id, *checked_targets])
                skill_target = legal_targets[0] if legal_targets else None
                decision = AgentDecision(
                    actionType="night_action",
                    speechText="",
                    skillType="inspect" if skill_target else "pass",
                    skillTarget=skill_target,
                    nightAction=NightActionPlan(
                        inspectTarget=skill_target,
                        passReason=None if skill_target else "fallback_no_unchecked_target",
                    ),
                    confidence=0.30,
                    explain=["fallback_night_action_due_to_timeout_or_error"],
                )
            elif normalized_role == "witch":
                decision = AgentDecision(
                    actionType="night_action",
                    speechText="",
                    skillType="pass",
                    skillTarget=None,
                    nightAction=NightActionPlan(passReason="fallback_conservative_witch_pass"),
                    confidence=0.30,
                    explain=["fallback_night_action_due_to_timeout_or_error"],
                )
            else:
                decision = AgentDecision(
                    actionType="night_action",
                    speechText="",
                    skillType="pass",
                    skillTarget=None,
                    nightAction=NightActionPlan(passReason="fallback_role_has_no_night_action"),
                    confidence=0.30,
                    explain=["fallback_night_action_due_to_timeout_or_error"],
                )
        elif req.stage.value == "death_shot":
            normalized_role = normalize_role_name(req.role)
            death_reason = str(req.private_vision.get("deathReason") or "").strip().lower()
            hunter_can_shoot = bool(req.private_vision.get("hunterCanShoot", False))
            hunter_shot_used = bool(req.private_vision.get("hunterShotUsed", False))
            can_shoot = (
                normalized_role == "hunter"
                and hunter_can_shoot
                and not hunter_shot_used
                and death_reason not in {"witch_poison", "poison", "poisoned"}
            )
            legal_targets = self._legal_targets_excluding(req, [req.ai_id])
            skill_target = legal_targets[0] if (can_shoot and legal_targets) else None
            decision = AgentDecision(
                actionType="death_shot",
                speechText="",
                skillType="shoot" if skill_target else "pass",
                skillTarget=skill_target,
                confidence=0.30,
                explain=["fallback_death_shot_due_to_timeout_or_error"],
            )
        else:
            decision = AgentDecision(
                actionType="speech",
                speechText="I need one more round of information, so I will make a cautious public statement first.",
                confidence=0.40,
                explain=["fallback_speech_due_to_timeout_or_error"],
            )
        return AgentInvokeResult(
            requestId=req.request_id,
            gameId=req.game_id,
            aiId=req.ai_id,
            stage=req.stage,
            decision=decision,
            suspicionScores=[],
            latencyMs=latency_ms,
            fallbackUsed=True,
            errorCode=error_code,
        )

    def invoke(self, req: AgentInvokeRequest) -> AgentInvokeResult:
        start = time.time()
        if req.visible_events:
            self.memory_service.ingest_visible_events(
                req.game_id,
                req.ai_id,
                req.visible_events,
                req.candidate_targets,
            )
        try:
            if req.llm is None:
                raise ValueError("missing llm config")
            prompt_messages = self._build_prompt(req)
            raw = self.llm_gateway.generate_json(req.llm, prompt_messages)
            decision = AgentDecision.model_validate(raw)
            decision = self._validate_decision(req, decision)
            raw_scores = raw.get("suspicionScores", [])
            scores: list[SuspicionScore] = []
            if isinstance(raw_scores, list):
                for item in raw_scores:
                    try:
                        scores.append(SuspicionScore.model_validate(item))
                    except ValidationError:
                        continue

            latency_ms = int((time.time() - start) * 1000)
            result = AgentInvokeResult(
                requestId=req.request_id,
                gameId=req.game_id,
                aiId=req.ai_id,
                stage=req.stage,
                decision=decision,
                suspicionScores=scores,
                latencyMs=latency_ms,
                fallbackUsed=False,
                errorCode=None,
            )
        except Exception:  # noqa: BLE001
            latency_ms = int((time.time() - start) * 1000)
            logger.exception(
                "AI invoke failed; request_id=%s game_id=%s ai_id=%s stage=%s role=%s "
                "provider=%s model=%s candidate_targets=%s private_vision_keys=%s",
                req.request_id,
                req.game_id,
                req.ai_id,
                req.stage.value,
                req.role,
                req.llm.provider if req.llm else None,
                req.llm.model_name if req.llm else None,
                req.candidate_targets,
                sorted(req.private_vision.keys()),
            )
            result = self._fallback_result(req, latency_ms, error_code="INVOKE_FAILED")

        self.memory_service.record_decision(
            req.game_id,
            req.ai_id,
            req.stage.value,
            result.decision.model_dump(by_alias=True),
        )
        return result

    async def invoke_async(self, req: AgentInvokeRequest) -> AgentInvokeResult:
        return await asyncio.to_thread(self.invoke, req)

    async def callback(self, callback_url: str, result: AgentInvokeResult) -> None:
        payload = json.dumps(result.model_dump(by_alias=True), ensure_ascii=False).encode("utf-8")
        req = urlrequest.Request(
            callback_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        await asyncio.to_thread(urlrequest.urlopen, req, 10)
