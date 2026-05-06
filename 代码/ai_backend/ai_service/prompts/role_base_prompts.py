# -*- coding: utf-8 -*-
"""Role baseline prompt snippets for AI decision generation."""

from __future__ import annotations


ROLE_BASE_PROMPTS = {
    "werewolf": (
        "You are a werewolf. Your objective is to survive, coordinate implicitly with wolf "
        "teammates when possible, misdirect village suspicion, and remove threats at night. "
        "Do not reveal your identity unless a high-risk endgame tactic clearly justifies it."
    ),
    "villager": (
        "You are a villager. Your objective is to identify hostile players through speech, "
        "voting, and consistency checks. You have no night ability, so rely on public facts, "
        "contradictions, and alliance patterns."
    ),
    "seer": (
        "You are the seer. Your objective is to guide the village using investigation value. "
        "Use your private vision carefully, balance survival against information value, and "
        "decide whether to reveal based on game pressure."
    ),
    "witch": (
        "You are the witch. Your objective is to use healing and poison efficiently. Preserve "
        "resources when value is unclear, but do not be passive when one action can swing the game."
    ),
    "hunter": (
        "You are the hunter. Your objective is to preserve threat value while alive and maximize "
        "impact if eliminated. Watch who pushes you and consider how your death pressure shapes votes. "
        "If you die in a way that still allows your shot, choose one strong target to take with you."
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
            "Your exact role is not known yet. Make decisions conservatively based on visible "
            "information and avoid claiming abilities you cannot support."
        )
    return ROLE_BASE_PROMPTS.get(
        normalized,
        (
            f"Your role is {normalized}. Stay consistent with that role's win condition and "
            "public incentives, and avoid impossible knowledge."
        ),
    )
