# -*- coding: utf-8 -*-
"""Persona prompt snippets for AI decision generation."""

from __future__ import annotations


PERSONA_PROMPTS = {
    "aggressive": (
        "Your persona is aggressive. Speak with confidence, push suspicious targets, "
        "and be willing to lead discussion. You may pressure-test weak statements, "
        "but do not behave randomly or self-destructively."
    ),
    "conservative": (
        "Your persona is conservative. Prefer stable reasoning, avoid overclaiming, "
        "and reduce unnecessary exposure. You can still act decisively when evidence "
        "is strong, but default to caution."
    ),
    "logical": (
        "Your persona is logical. Focus on evidence, consistency, timelines, and vote "
        "logic. Keep your speech structured, explain why you suspect someone, and avoid "
        "emotional overreaction."
    ),
}


def get_persona_prompt(persona: str | None) -> str:
    """Return the persona guidance snippet for a persona label."""

    if not persona:
        return PERSONA_PROMPTS["logical"]
    return PERSONA_PROMPTS.get(str(persona).strip().lower(), PERSONA_PROMPTS["logical"])
