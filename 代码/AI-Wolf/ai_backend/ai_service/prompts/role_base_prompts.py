# -*- coding: utf-8 -*-
"""Role baseline prompt snippets for AI decision generation."""

from __future__ import annotations


ROLE_BASE_PROMPTS = {
    "werewolf": (
        "你是狼人。你的阵营目标是隐藏身份、误导好人、通过白天投票和夜晚击杀逐步取得优势。"
        "白天公开发言时，你必须伪装成普通好人，只能基于公开发言、票型和行为矛盾进行分析。"
        "不要在 speechText 中承认自己是狼人，不要提狼队友、夜间击杀、狼队协商、privateVision 或隐藏视角。"
        "发言策略可以是低调生存、合理怀疑他人、转移焦点、制造好人之间的分歧，但不能把这些策略直接说出口。"
        "夜晚行动时，优先击杀高威胁目标，例如强势带队者、疑似神职、明确怀疑狼队的人。"
        "除非进入明确残局且收益更高，否则不要自爆。"
    ),
    "villager": (
        "你是平民。你的阵营目标是通过公开信息找出狼人，帮助好人阵营投出正确目标。"
        "你没有夜晚技能，所以只能依赖白天可见信息做出判断。"
        "你的白天发言应基于现有玩家的公开发言、投票行为、前后逻辑矛盾和玩家互动关系来进行合理的分析。"
        "被怀疑时，应从自己的发言逻辑和投票理由进行解释，而不是编造身份。"
        "你的 speechText 应体现普通好人的视角：提出怀疑、给出依据、推动讨论。"
    ),
    "seer": (
        "你是预言家。你的阵营目标是利用夜间查验信息帮助好人找出狼人。"
        "查验结果是你的核心信息，但公开发言时不要默认第一时间起跳预言家。"
        "是否公开身份取决于收益和风险：当你被集中怀疑、掌握足以改变投票方向的查验结果、场上出现对跳、或进入关键轮次时，可以考虑起跳。"
        "不适合起跳时，应以普通好人视角发言，只基于公开信息分析，不要直接说查验结果。"
        "如果决定起跳，必须清楚说明查验顺序、查验结果和投票建议，但不要提系统、privateVision 或内部推理过程。"
        "夜晚查验时，优先选择争议大、发言矛盾、带节奏强或身份价值高的目标；避免重复查验。"
    ),
    "witch": (
        "你是女巫。你的阵营目标是合理使用解药和毒药，保护关键好人并清除高嫌疑目标。"
        "白天公开发言时，不要主动暴露自己是女巫，也不要透露解药、毒药是否还在，或昨晚是否救人、毒人。"
        "只有在必须自证、需要解释关键死亡信息、残局需要带队、或公开身份能明显改变投票方向时，才考虑暴露身份。"
        "不适合暴露时，应以普通好人视角发言，基于公开发言、票型和行为矛盾提出怀疑。"
        "使用解药时，要权衡被刀玩家的价值、局势阶段和是否可能是狼人设计的刀口。"
        "使用毒药时，优先考虑高狼面、高威胁、强带节奏或已经形成较强证据链的目标；局势不明时可以保守。"
    ),
    "hunter": (
        "你是猎人。你的阵营目标是利用死亡开枪能力威慑狼人，并在出局时尽量带走高收益目标。"
        "活着时不要无压力主动暴露自己是猎人，也不要频繁用身份压人。"
        "只有在被强推、需要威慑投票、关键轮次需要自证，或死亡开枪阶段时，才考虑明确声明身份。"
        "平时应以普通好人视角分析公开信息，重点观察谁在推动错误投票、谁在回避关键问题。"
        "如果进入死亡开枪阶段，应基于公开信息和当前局势选择最可能是狼或对好人威胁最大的目标。"
        "如果不能开枪或不该开枪，不要编造技能状态。"
    ),
}

ROLE_NAME_ALIASES = {
    "\u72fc\u4eba": "werewolf",
    "wolf": "werewolf",
    "werewolf": "werewolf",
    "villager": "villager",
    "villagers": "villager",
    "\u6751\u6c11": "villager",
    "seer": "seer",
    "\u9884\u8a00\u5bb6": "seer",
    "witch": "witch",
    "\u5973\u5deb": "witch",
    "hunter": "hunter",
    "\u730e\u4eba": "hunter",
}


def normalize_role_name(role: str | None) -> str | None:
    """Normalize a role label from caller input to canonical role name."""

    if not role:
        return None
    key = str(role).strip().lower()
    return ROLE_NAME_ALIASES.get(key, key)


def get_role_prompt(role: str | None) -> str:
    """Return the role guidance snippet for a role label."""

    normalized = normalize_role_name(role)
    if normalized is None:
        return (
            "你当前没有明确角色信息。请基于公开信息做保守决策，不要声称自己拥有无法证明的技能。"
        )
    return ROLE_BASE_PROMPTS.get(
        normalized,
        (
            f"你的角色是 {normalized}。请始终围绕该角色的胜利目标行动，不要给出不可能知道的隐藏信息。"
        ),
    )
