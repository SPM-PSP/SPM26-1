# -*- coding: utf-8 -*-
"""Pydantic models for AI service APIs."""

from __future__ import annotations

from typing import Any
from uuid import uuid4
from time import time
from enum import Enum

from pydantic import BaseModel, Field

from .enums import EventType, ModelProvider, PersonaType


def _now_ms() -> int:
    return int(time() * 1000)


class BaseApiResponse(BaseModel):
    """Unified response envelope."""

    code: int = 200
    message: str = "ok"
    timestamp: int = Field(default_factory=_now_ms)
    data: Any = None


class ModelPolicy(BaseModel):
    """Model binding policy for generated AI players."""

    provider: ModelProvider | str | None = None
    model_name: str | None = None
    base_url: str | None = None


class AgentProfile(BaseModel):
    """Runtime profile for one AI player."""

    ai_id: str
    game_id: str
    room_id: str | None = None
    seat: int
    role: str | None = None
    persona: PersonaType = PersonaType.LOGICAL
    model_provider: str
    model_name: str
    model_base_url: str | None = None


class GeneratePlayersRequest(BaseModel):
    """Request to generate AI player instances for a game."""

    game_id: str = Field(alias="gameId")
    room_id: str | None = Field(default=None, alias="roomId")
    ai_count: int = Field(default=1, ge=1, le=20, alias="aiCount")
    model_policy: ModelPolicy | None = Field(default=None, alias="modelPolicy")

    class Config:
        populate_by_name = True


class GeneratePlayersResponse(BaseModel):
    """Response payload for generated players."""

    game_id: str = Field(alias="gameId")
    room_id: str | None = Field(default=None, alias="roomId")
    players: list[AgentProfile]

    class Config:
        populate_by_name = True


class PersonaPolicy(BaseModel):
    """Numeric behavior policy for a persona."""

    persona: PersonaType
    speech_risk: float = Field(alias="speechRisk", ge=0.0, le=1.0)
    vote_volatility: float = Field(alias="voteVolatility", ge=0.0, le=1.0)
    follow_group: float = Field(alias="followGroup", ge=0.0, le=1.0)

    class Config:
        populate_by_name = True


class PersonaAssignment(BaseModel):
    """Assign one persona to one AI player."""

    ai_id: str = Field(alias="aiId")
    persona: PersonaType

    class Config:
        populate_by_name = True


class AssignPersonaRequest(BaseModel):
    """Request to assign persona policies for a game."""

    game_id: str = Field(alias="gameId")
    assignments: list[PersonaAssignment]

    class Config:
        populate_by_name = True


class AssignPersonaResponse(BaseModel):
    """Response payload for persona assignment."""

    game_id: str = Field(alias="gameId")
    assignments: list[PersonaAssignment]
    policies: dict[str, PersonaPolicy]

    class Config:
        populate_by_name = True


class RoleAssignment(BaseModel):
    """Assign one role name to one AI player."""

    ai_id: str = Field(alias="aiId")
    role: str

    class Config:
        populate_by_name = True


class AssignRolesRequest(BaseModel):
    """Request to assign concrete game roles for a game."""

    game_id: str = Field(alias="gameId")
    assignments: list[RoleAssignment]

    class Config:
        populate_by_name = True


class AssignRolesResponse(BaseModel):
    """Response payload for role assignment."""

    game_id: str = Field(alias="gameId")
    assignments: list[RoleAssignment]

    class Config:
        populate_by_name = True


class SuspicionScore(BaseModel):
    """Suspicion score for one target player."""

    target: str
    score: float
    reasons: list[str] = Field(default_factory=list)
    updated_at: int = Field(default_factory=_now_ms, alias="updatedAt")

    class Config:
        populate_by_name = True


class AgentMemoryItem(BaseModel):
    """One structured memory event."""

    event_id: str = Field(default_factory=lambda: uuid4().hex, alias="eventId")
    day: int = 0
    stage: int = 0
    event_type: EventType = Field(alias="eventType")
    speaker: str
    content: str
    weight: float = 1.0
    timestamp: int = Field(default_factory=_now_ms)
    targets: list[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class AgentMemoryState(BaseModel):
    """All memory data for one AI."""

    game_id: str = Field(alias="gameId")
    ai_id: str = Field(alias="aiId")
    memory_window: list[AgentMemoryItem] = Field(
        default_factory=list, alias="memoryWindow"
    )
    long_summary: str = Field(default="", alias="longSummary")
    relations: dict[str, str] = Field(default_factory=dict)
    suspicion_scores: dict[str, SuspicionScore] = Field(
        default_factory=dict, alias="suspicionScores"
    )
    last_decisions: list[dict[str, Any]] = Field(default_factory=list, alias="lastDecisions")
    updated_at: int = Field(default_factory=_now_ms, alias="updatedAt")

    class Config:
        populate_by_name = True


class InitMemoryRequest(BaseModel):
    """Request to initialize memory for multiple AIs in one game."""

    game_id: str = Field(alias="gameId")
    players: list[str]
    async_mode: bool = Field(default=True, alias="asyncMode")

    class Config:
        populate_by_name = True


class InitMemoryResponse(BaseModel):
    """Response payload for memory initialization."""

    game_id: str = Field(alias="gameId")
    initialized: list[str]
    async_mode: bool = Field(alias="asyncMode")

    class Config:
        populate_by_name = True


class AppendMemoryEventRequest(BaseModel):
    """Request to append one event into one AI memory."""

    game_id: str = Field(alias="gameId")
    ai_id: str = Field(alias="aiId")
    event: AgentMemoryItem
    candidate_targets: list[str] = Field(default_factory=list, alias="candidateTargets")
    async_mode: bool = Field(default=True, alias="asyncMode")

    class Config:
        populate_by_name = True


class BroadcastGameEventRequest(BaseModel):
    """Broadcast one public game event into all AI memories of a game."""

    game_id: str = Field(alias="gameId")
    event: AgentMemoryItem
    ai_ids: list[str] | None = Field(default=None, alias="aiIds")
    candidate_targets: list[str] = Field(default_factory=list, alias="candidateTargets")
    async_mode: bool = Field(default=True, alias="asyncMode")

    class Config:
        populate_by_name = True


class BroadcastGameEventResponse(BaseModel):
    """Response payload for public event broadcast."""

    game_id: str = Field(alias="gameId")
    event: AgentMemoryItem
    applied_ai_ids: list[str] = Field(alias="appliedAiIds")
    states: dict[str, AgentMemoryState]
    async_mode: bool = Field(alias="asyncMode")

    class Config:
        populate_by_name = True


class BootstrapRequest(BaseModel):
    """One-shot bootstrap for players + memory + persona."""

    game_id: str = Field(alias="gameId")
    room_id: str | None = Field(default=None, alias="roomId")
    ai_count: int = Field(default=1, ge=1, le=20, alias="aiCount")
    model_policy: ModelPolicy | None = Field(default=None, alias="modelPolicy")
    persona_assignments: list[PersonaAssignment] | None = Field(
        default=None, alias="personaAssignments"
    )
    async_mode: bool = Field(default=True, alias="asyncMode")

    class Config:
        populate_by_name = True


class BootstrapResponse(BaseModel):
    """Response payload for bootstrap API."""

    game_id: str = Field(alias="gameId")
    room_id: str | None = Field(default=None, alias="roomId")
    players: list[AgentProfile]
    memory_initialized: list[str] = Field(alias="memoryInitialized")
    persona_assignments: list[PersonaAssignment] = Field(alias="personaAssignments")
    async_mode: bool = Field(alias="asyncMode")

    class Config:
        populate_by_name = True


class InvokeStage(str, Enum):
    """Supported invoke stages."""

    SPEECH = "speech"
    VOTE = "vote"
    NIGHT_ACTION = "night_action"
    DEATH_SHOT = "death_shot"


class LLMInvokeConfig(BaseModel):
    """Per-request LLM config."""

    provider: str = "openai-compatible"
    model_name: str = Field(alias="modelName")
    api_key: str | None = Field(default=None, alias="apiKey")
    base_url: str | None = Field(default=None, alias="baseUrl")
    temperature: float = 0.3
    max_tokens: int = Field(default=512, alias="maxTokens")
    timeout_seconds: int = Field(default=12, alias="timeoutSeconds")

    class Config:
        populate_by_name = True


class AgentInvokeRequest(BaseModel):
    """Request schema for concrete LLM invocation."""

    request_id: str = Field(alias="requestId")
    game_id: str = Field(alias="gameId")
    ai_id: str = Field(alias="aiId")
    stage: InvokeStage
    role: str | None = None
    persona: PersonaType | None = None
    llm: LLMInvokeConfig | None = None
    visible_events: list[dict[str, Any]] = Field(default_factory=list, alias="visibleEvents")
    alive_players: list[str] = Field(default_factory=list, alias="alivePlayers")
    candidate_targets: list[str] = Field(default_factory=list, alias="candidateTargets")
    private_vision: dict[str, Any] = Field(default_factory=dict, alias="privateVision")
    callback_url: str | None = Field(default=None, alias="callbackUrl")
    async_mode: bool = Field(default=True, alias="asyncMode")

    class Config:
        populate_by_name = True


class NightActionPlan(BaseModel):
    """Structured night action payload for role-specific abilities."""

    kill_target: str | None = Field(default=None, alias="killTarget")
    inspect_target: str | None = Field(default=None, alias="inspectTarget")
    save_target: str | None = Field(default=None, alias="saveTarget")
    poison_target: str | None = Field(default=None, alias="poisonTarget")
    pass_reason: str | None = Field(default=None, alias="passReason")

    class Config:
        populate_by_name = True


class AgentDecision(BaseModel):
    """Normalized decision payload returned to game service."""

    action_type: str = Field(alias="actionType")
    speech_text: str = Field(default="", alias="speechText")
    vote_target: str | None = Field(default=None, alias="voteTarget")
    skill_type: str | None = Field(default=None, alias="skillType")
    skill_target: str | None = Field(default=None, alias="skillTarget")
    night_action: NightActionPlan | None = Field(default=None, alias="nightAction")
    confidence: float = 0.5
    explain: list[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class AgentInvokeResult(BaseModel):
    """Result body of invoke processing."""

    request_id: str = Field(alias="requestId")
    game_id: str = Field(alias="gameId")
    ai_id: str = Field(alias="aiId")
    stage: InvokeStage
    decision: AgentDecision
    suspicion_scores: list[SuspicionScore] = Field(default_factory=list, alias="suspicionScores")
    latency_ms: int = Field(default=0, alias="latencyMs")
    fallback_used: bool = Field(default=False, alias="fallbackUsed")
    error_code: str | None = Field(default=None, alias="errorCode")

    class Config:
        populate_by_name = True


class WerewolfNightConsensusRequest(BaseModel):
    """Batch request for all-AI werewolf night advice aggregation."""

    request_id: str = Field(alias="requestId")
    game_id: str = Field(alias="gameId")
    werewolf_ai_ids: list[str] = Field(alias="werewolfAiIds", min_length=1)
    visible_events: list[dict[str, Any]] = Field(default_factory=list, alias="visibleEvents")
    alive_players: list[str] = Field(default_factory=list, alias="alivePlayers")
    candidate_targets: list[str] = Field(default_factory=list, alias="candidateTargets")
    private_vision: dict[str, Any] = Field(default_factory=dict, alias="privateVision")

    class Config:
        populate_by_name = True


class WerewolfAdviceItem(BaseModel):
    """One AI werewolf's structured night recommendation."""

    ai_id: str = Field(alias="aiId")
    suggested_target: str | None = Field(default=None, alias="suggestedTarget")
    confidence: float = 0.0
    explain: list[str] = Field(default_factory=list)
    speech_text: str = Field(default="", alias="speechText")
    suspicion_scores: list[SuspicionScore] = Field(default_factory=list, alias="suspicionScores")
    fallback_used: bool = Field(default=False, alias="fallbackUsed")
    error_code: str | None = Field(default=None, alias="errorCode")
    latency_ms: int = Field(default=0, alias="latencyMs")

    class Config:
        populate_by_name = True


class WerewolfConsensusScore(BaseModel):
    """Aggregated score for one candidate target."""

    target: str
    recommendation_count: int = Field(alias="recommendationCount")
    confidence_sum: float = Field(alias="confidenceSum")
    score: float
    recommenders: list[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class WerewolfNightConsensusResponse(BaseModel):
    """Aggregated consensus output for all-AI werewolf night handling."""

    request_id: str = Field(alias="requestId")
    game_id: str = Field(alias="gameId")
    werewolf_ai_ids: list[str] = Field(alias="werewolfAiIds")
    legal_targets: list[str] = Field(default_factory=list, alias="legalTargets")
    advice_results: list[WerewolfAdviceItem] = Field(default_factory=list, alias="adviceResults")
    aggregate_scores: list[WerewolfConsensusScore] = Field(default_factory=list, alias="aggregateScores")
    consensus_target: str | None = Field(default=None, alias="consensusTarget")
    final_kill_target: str | None = Field(default=None, alias="finalKillTarget")
    execution_decision: AgentDecision | None = Field(default=None, alias="executionDecision")
    shared_private_vision: dict[str, Any] = Field(default_factory=dict, alias="sharedPrivateVision")
    private_vision_by_ai_id: dict[str, dict[str, Any]] = Field(
        default_factory=dict,
        alias="privateVisionByAiId",
    )
    consensus_recorded_ai_ids: list[str] = Field(default_factory=list, alias="consensusRecordedAiIds")

    class Config:
        populate_by_name = True
