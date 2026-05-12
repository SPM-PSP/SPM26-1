# -*- coding: utf-8 -*-
"""Agent invoke service: run LLM decision + fallback + callback."""

from __future__ import annotations

import asyncio
import json
import logging
import re
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
                "狼人夜晚规则：\n"
                "- 用 nightAction.killTarget 选择击杀目标。\n"
                "- 除非 privateVision.allowFriendlyFire 为 true，否则不能刀 privateVision.wolfTeammates 里的队友。\n"
                "- 如果 privateVision.consensusTarget 存在且合法，优先跟随。\n"
                "- 如果 privateVision.forceConsensusTarget 为 true 且 consensusTarget 合法，必须严格跟随。\n"
                "- 如果 privateVision.wolfDecisionMode 为 \"advice_only\"，返回建议目标和理由，但不实际执行击杀。\n"
                "- 如果有 privateVision.teammateMessages 或 privateVision.wolfChat，要把它当作狼队协同信息。\n"
                "- 选择击杀目标时 skillType 设为 \"kill\"。\n"
                "- 如果当前公开信息很少，不要硬编“谁发言强势、谁像神职、谁威胁高”等并不存在的依据。\n"
                "- 信息不足时，可以直接承认“不确定”，也可以给出“先随便选一个非队友目标，仅供参考”的保守建议。\n"
                "- 只有输入里真的出现了对应线索，才能写具体击杀理由。\n"
            )

        if normalized_role == "seer":
            checked_text = ", ".join(checked_targets) if checked_targets else "无"
            return (
                "预言家夜晚规则：\n"
                "- 用 nightAction.inspectTarget 选择且仅选择一名查验目标。\n"
                f"- 记忆中已查验目标：{checked_text}。\n"
                "- 如果还有未查验且合法的目标，不要重复查同一人。\n"
                "- 选择查验目标时 skillType 设为 \"inspect\"。\n"
            )

        if normalized_role == "witch":
            return (
                "女巫夜晚规则：\n"
                "- privateVision.nightDeathCandidate 表示今晚被刀对象（若存在）。\n"
                "- privateVision.antidoteAvailable 表示解药是否可用。\n"
                "- privateVision.poisonAvailable 表示毒药是否可用。\n"
                "- 你可以救、毒、双动或过。\n"
                "- nightAction.saveTarget 只能填 nightDeathCandidate。\n"
                "- nightAction.poisonTarget 填毒药目标。\n"
                "- 若同夜救人并下毒，两字段都要填。\n"
                "- 如果不该行动或不能行动，两字段留空并说明原因。\n"
            )

        if normalized_role == "villager":
            return (
                "平民夜晚规则：\n"
                "- 平民没有夜晚技能。\n"
                "- 返回 pass 决策且不填目标。\n"
            )

        return (
            "夜晚通用规则：\n"
            "- 行动必须在角色合法能力范围内。\n"
            "- 没有合法夜晚动作时返回 pass。\n"
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
                "猎人开枪规则：\n"
                "- 本阶段只会在猎人出局触发。\n"
                "- privateVision.hunterCanShoot 表示本次是否允许开枪。\n"
                "- 如果 privateVision.deathReason 是 witch_poison、poison 或 poisoned，则不能开枪。\n"
                "- 如果 privateVision.hunterShotUsed 为 true，不能再次开枪。\n"
                "- 能开枪时，从 candidateTargets 里只选一个目标。\n"
                "- 开枪时 skillType 设为 \"shoot\"，skillTarget 设为目标。\n"
                "- 不能开枪时返回 pass，并在 explain 里说明原因。\n"
            )

        return (
            "特殊阶段规则：\n"
            "- 如果该角色没有死亡触发技能，返回 pass。\n"
        )

    def _build_vote_rules(self, req: AgentInvokeRequest, normalized_role: str | None) -> str:
        if req.stage != InvokeStage.VOTE:
            return ""

        if normalized_role == "werewolf":
            return (
                "狼人投票规则：\n"
                "- 尽量避免投 privateVision.wolfTeammates 里的狼队友。\n"
                "- 只有 privateVision.allowFriendlyFire 为 true 时才允许投狼队友。\n"
                "- 在可行情况下，优先从非队友 candidateTargets 中选择 voteTarget。\n"
            )

        return ""

    def _allowed_private_vision_keys(
        self,
        req: AgentInvokeRequest,
        normalized_role: str | None,
    ) -> set[str]:
        allowed: set[str] = set()

        if normalized_role == "werewolf":
            allowed.update({"wolfTeammates", "allowFriendlyFire", "consensusTarget", "teammateMessages", "wolfChat"})
            allowed.add("forceConsensusTarget")
            allowed.add("wolfDecisionMode")
        elif normalized_role == "witch" and req.stage == InvokeStage.NIGHT_ACTION:
            allowed.update({"nightDeathCandidate", "antidoteAvailable", "poisonAvailable"})
        elif normalized_role == "hunter" and req.stage == InvokeStage.DEATH_SHOT:
            allowed.update({"hunterCanShoot", "deathReason", "hunterShotUsed"})

        return allowed

    def _werewolf_decision_mode(self, req: AgentInvokeRequest) -> str:
        mode = str(req.private_vision.get("wolfDecisionMode") or "auto_execute").strip().lower()
        if mode in {"advice_only", "auto_execute"}:
            return mode
        return "auto_execute"

    def _build_werewolf_advice_text(
        self,
        suggested_target: str | None,
        speech_text: str,
        explain: list[str],
    ) -> str:
        if speech_text and speech_text.strip():
            return speech_text

        reason_text = "; ".join([x for x in explain if x][:2])
        if suggested_target:
            if reason_text:
                return f"建议今晚优先击杀 {suggested_target}。理由：{reason_text}。"
            return f"目前信息还不多，先给一个保守建议：今晚可以先击杀 {suggested_target}，仅供参考。"

        if reason_text:
            return f"我暂时没有稳定击杀目标。理由：{reason_text}。"
        return "我暂时没有稳定击杀目标。现在信息偏少，如果一定要动手，就先随便选一个非队友目标，仅供参考。"

    def _sanitize_private_vision_for_prompt(
        self,
        req: AgentInvokeRequest,
        normalized_role: str | None,
    ) -> dict[str, object]:
        allowed_keys = self._allowed_private_vision_keys(req, normalized_role)
        if not allowed_keys:
            if req.private_vision:
                logger.warning(
                    "Dropping unexpected privateVision for prompt; game_id=%s ai_id=%s role=%s stage=%s keys=%s",
                    req.game_id,
                    req.ai_id,
                    normalized_role,
                    req.stage.value,
                    sorted(req.private_vision.keys()),
                )
            return {}

        sanitized = {
            key: value for key, value in req.private_vision.items() if key in allowed_keys
        }
        dropped = sorted(set(req.private_vision.keys()) - set(sanitized.keys()))
        if dropped:
            logger.warning(
                "Dropped privateVision keys for prompt; game_id=%s ai_id=%s role=%s stage=%s dropped=%s",
                req.game_id,
                req.ai_id,
                normalized_role,
                req.stage.value,
                dropped,
            )
        return sanitized

    def _strip_sensitive_event_fields(self, value: object) -> object:
        banned_keys = {
            "role",
            "trueRole",
            "revealedRole",
            "identity",
            "alignment",
            "camp",
            "faction",
            "side",
            "team",
            "teams",
            "allRoles",
            "playerRoles",
            "roleMap",
            "secretRole",
        }
        if isinstance(value, dict):
            sanitized: dict[str, object] = {}
            for key, item in value.items():
                if key in banned_keys:
                    continue
                sanitized[key] = self._strip_sensitive_event_fields(item)
            return sanitized
        if isinstance(value, list):
            return [self._strip_sensitive_event_fields(item) for item in value]
        return value

    def _sanitize_visible_events_for_prompt(self, req: AgentInvokeRequest) -> list[dict[str, object]]:
        sanitized_events: list[dict[str, object]] = []
        dropped_any = False
        for event in req.visible_events[-30:]:
            if not isinstance(event, dict):
                continue
            sanitized = self._strip_sensitive_event_fields(event)
            if sanitized != event:
                dropped_any = True
            if isinstance(sanitized, dict):
                sanitized_events.append(sanitized)

        if dropped_any:
            logger.warning(
                "Dropped sensitive fields from visibleEvents for prompt; game_id=%s ai_id=%s stage=%s",
                req.game_id,
                req.ai_id,
                req.stage.value,
            )
        return sanitized_events

    def _fallback_public_speech(self, req: AgentInvokeRequest) -> str:
        if req.stage == InvokeStage.SPEECH:
            return "目前公开信息还不够，我先保留判断，等大家多聊一点再看。"
        if req.stage == InvokeStage.VOTE:
            return "基于目前公开信息，我先做一个保守判断。"
        if req.stage == InvokeStage.DEATH_SHOT:
            return "我会基于公开信息做最后的判断。"
        return ""

    def _looks_like_internal_monologue(self, req: AgentInvokeRequest, speech_text: str) -> bool:
        text = (speech_text or "").strip()
        if not text:
            return False

        normalized_role = normalize_role_name(req.role)
        patterns = [
            r"(作为|我是).{0,8}(逻辑型玩家|保守型玩家|激进型玩家|AI|ai)",
            r"狼人团队",
            r"wolf team",
            r"privateVision",
            r"隐藏身份",
            r"引导舆论",
            r"避免过早暴露",
            r"keep a low profile",
            r"avoid exposing",
        ]
        if any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns):
            return True

        return False

    def _sanitize_public_speech(self, req: AgentInvokeRequest, decision: AgentDecision) -> AgentDecision:
        speech_text = decision.speech_text or ""
        if not self._looks_like_internal_monologue(req, speech_text):
            return decision

        logger.warning(
            "Sanitized suspicious public speech; game_id=%s ai_id=%s role=%s stage=%s speech=%r",
            req.game_id,
            req.ai_id,
            req.role,
            req.stage.value,
            speech_text,
        )
        return decision.model_copy(update={"speech_text": self._fallback_public_speech(req)})

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
            "你正在参加一局狼人杀社交推理游戏。\n\n"
            f"{role_prompt}\n\n"
            f"{persona_prompt}\n\n"
            "基础规则：\n"
            "- 只能使用当前玩家可见的信息。\n"
            "- 如果提供了 privateVision，可以用于你的私下判断，但不能把 privateVision 本身当成公开信息说出来。\n"
            "- 决策要符合你的角色动机、当前阶段目标和胜利条件。\n"
            "- 不要输出空泛总结，优先输出可执行判断。\n\n"
            
            f"{night_rules}\n"
            f"{vote_rules}\n"
            f"{special_stage_rules}\n"
            
            "公开发言身份策略：\n"
            "- speechText 是其他玩家都能听到的公开发言，不是你的内心想法、复盘或推理过程全文。\n"
            "- 默认情况下，不要主动说出自己的真实身份、夜间行动、技能状态或私密视角。\n"
            "- 只有在公开发言收益明显高于暴露风险时，才允许声明身份或技能信息。\n"
            "- 允许声明身份的典型情况包括：你被多人集中怀疑且即将出局；你掌握的信息足以改变投票方向；当前是必须交代身份的关键轮次；猎人死亡开枪等特殊阶段。\n"
            "- 不允许在没有压力、没有收益、没有人要求你交代身份时，第一句话就说'我是预言家/女巫/猎人/狼人'。\n"
            "- 如果你是神职但暂时不适合跳身份，应当用普通好人的视角发言，只谈公开发言、票型和行为矛盾。\n"
            "- 如果你是狼人，公开发言中必须伪装成好人视角，不能提狼队、刀人、队友或夜间协商。\n"
            "- 如果你决定跳身份，必须给出公开场上能理解的理由，而不是因为系统告诉了你身份。\n\n"

            "真人玩家发言风格：\n"
            "- speechText 要像真人玩家在狼人杀桌上的自然发言，不要像总结报告、判决书、教程或机器人分析。\n"
            "- speechText 通常为 2-5 句，允许有口语化停顿、转折和不确定表达，但不要啰嗦。\n"
            "- 发言可以包含：先表态、再给一两个具体依据、最后点一个想听发言或想重点观察的人。\n"
            "- 不要每次都使用固定模板，例如“我认为...因为...所以...”。句式要有变化。\n"
            "- 可以使用自然口语词，例如“我有点在意”“这点我没太听懂”“先不站死”“我想再听一下”“这里有点怪”。\n"
            "- 允许适度表达犹豫、保留、反问或压力感，但不要戏剧化表演，不要过度情绪化。\n"
            "- 发言要围绕当前局势中的具体玩家、具体发言、投票或行为，不要只说泛泛的‘信息不足’。\n"
            "- 如果证据不足，可以保留意见，但仍要给出当前最想观察或最怀疑的方向。\n"
            "- 不要自称“逻辑型玩家”“保守型玩家”“激进型玩家”“AI玩家”。\n\n"
            
            "只返回一个 JSON 对象，结构如下：\n"
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
           
            "输出规则：\n"
            "- actionType 必须和当前 stage 对应。\n"
            "- speechText 必须是“桌面公开发言”，不是思维链、不是复盘、不是教程。\n"
            "- speechText 禁止出现“我是AI/作为AI/作为逻辑型玩家/根据我的推理过程”等元叙事。\n"
            "- speechText 禁止无收益泄露 privateVision、隐藏身份、狼人队友、夜间私密信息；只有符合身份暴露规则时，才允许有限度声明身份或技能信息。\n"
            "- speechText 和 explain 只能基于输入里真实存在的信息，不能编造不存在的发言、票型、行为和身份线索。\n"
            "- 如果当前信息不足，允许直接承认“不确定”，并给出保守建议；不要为了显得合理而补充虚假分析。\n"
            "- speechText 最好包含：当前立场 + 一个依据 + 一个追问/建议目标。\n"
            "- 当 candidateTargets 非空时，voteTarget 和 skillTarget 必须从中选择。\n"
            "- night_action 阶段仅填写合法的 nightAction 字段。\n"
            "- death_shot 阶段只有猎人可以输出 shoot 行为。\n"
            "- confidence 范围是 0 到 1。\n"
            "- explain 用简短关键词说明原因，不要写长段分析。"
        )
        memory_hints: dict[str, object] = {}
        if checked_targets:
            memory_hints["alreadyCheckedTargets"] = checked_targets
        prompt_private_vision = self._sanitize_private_vision_for_prompt(req, normalized_role)
        prompt_visible_events = self._sanitize_visible_events_for_prompt(req)
        user_payload = {
            "requestId": req.request_id,
            "gameId": req.game_id,
            "aiId": req.ai_id,
            "stage": req.stage.value,
            "role": normalized_role,
            "persona": req.persona.value if req.persona else None,
            "alivePlayers": req.alive_players,
            "candidateTargets": req.candidate_targets,
            "privateVision": prompt_private_vision,
            "visibleEvents": prompt_visible_events,
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
            force_consensus_target = bool(req.private_vision.get("forceConsensusTarget", False))
            decision_mode = self._werewolf_decision_mode(req)
            target = night_action.kill_target
            if force_consensus_target and consensus_target in legal_targets:
                target = str(consensus_target)
            elif target not in legal_targets:
                if consensus_target in legal_targets:
                    target = str(consensus_target)
                else:
                    target = legal_targets[0] if legal_targets else None

            if decision_mode == "advice_only":
                advice_text = self._build_werewolf_advice_text(target, default_speech, explain)
                return decision.model_copy(
                    update={
                        "action_type": "night_action",
                        "skill_type": "pass",
                        "skill_target": None,
                        "vote_target": None,
                        "night_action": NightActionPlan(
                            killTarget=target,
                            passReason="advice_only_human_wolf_decides",
                        ),
                        "speech_text": advice_text,
                        "explain": explain or ["werewolf_advice_only_mode"],
                    }
                )

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
            result = decision.model_copy(
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
            return self._sanitize_public_speech(req, result)

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
            result = decision.model_copy(
                update={
                    "action_type": "vote",
                    "vote_target": target,
                    "skill_type": None,
                    "skill_target": None,
                    "night_action": None,
                    "explain": explain or ["vote_stage_response"],
                }
            )
            return self._sanitize_public_speech(req, result)

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
                consensus_target = req.private_vision.get("consensusTarget")
                force_consensus_target = bool(req.private_vision.get("forceConsensusTarget", False))
                decision_mode = self._werewolf_decision_mode(req)
                if force_consensus_target and consensus_target in legal_targets:
                    skill_target = str(consensus_target)
                else:
                    skill_target = legal_targets[0] if legal_targets else None
                if decision_mode == "advice_only":
                    advice_text = self._build_werewolf_advice_text(
                        skill_target,
                        "",
                        ["fallback_werewolf_advice_due_to_timeout_or_error"],
                    )
                    decision = AgentDecision(
                        actionType="night_action",
                        speechText=advice_text,
                        skillType="pass",
                        skillTarget=None,
                        nightAction=NightActionPlan(
                            killTarget=skill_target,
                            passReason="advice_only_human_wolf_decides",
                        ),
                        confidence=0.30,
                        explain=["fallback_werewolf_advice_due_to_timeout_or_error"],
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
