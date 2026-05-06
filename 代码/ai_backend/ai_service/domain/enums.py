# -*- coding: utf-8 -*-
"""Enums used by AI service APIs."""

from enum import Enum


class PersonaType(str, Enum):
    """Supported persona styles."""

    AGGRESSIVE = "aggressive"
    CONSERVATIVE = "conservative"
    LOGICAL = "logical"


class ModelProvider(str, Enum):
    """Known model providers."""

    DASHSCOPE = "dashscope"
    OPENAI = "openai"
    OLLAMA = "ollama"
    CUSTOM = "custom"


class EventType(str, Enum):
    """Memory event categories."""

    SPEECH = "speech"
    VOTE = "vote"
    SKILL = "skill"
    DEATH = "death"
    SYSTEM = "system"

