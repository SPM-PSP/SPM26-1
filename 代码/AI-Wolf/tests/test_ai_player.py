# -*- coding: utf-8 -*-
"""Unit tests for AI player service logic.

The tests use in-memory repositories and fake LLM responses. They do not call
external model APIs, databases, rooms, or frontend/backend services.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from ai_backend.ai_service.domain.enums import EventType, PersonaType
from ai_backend.ai_service.domain.models import (
    AgentDecision,
    AgentInvokeRequest,
    AgentInvokeResult,
    AgentMemoryItem,
    AgentMemoryState,
    AgentProfile,
    GeneratePlayersRequest,
    InitMemoryRequest,
    InvokeStage,
    LLMInvokeConfig,
    NightActionPlan,
    PersonaPolicy,
    RoleAssignment,
    WerewolfConsensusScore,
    WerewolfNightConsensusRequest,
)
from ai_backend.ai_service.prompts.persona_prompts import get_persona_prompt
from ai_backend.ai_service.prompts.role_base_prompts import normalize_role_name
from ai_backend.ai_service.repositories.memory_repo import MemoryRepository
from ai_backend.ai_service.services.context_assembler import ContextAssembler
from ai_backend.ai_service.services.invoke_service import InvokeService
from ai_backend.ai_service.services.llm_gateway import _extract_first_json
from ai_backend.ai_service.services.memory_service import MemoryService
from ai_backend.ai_service.services.persona_service import PersonaService
from ai_backend.ai_service.services.player_factory import PlayerFactoryService
from ai_backend.ai_service.services.werewolf_team_service import WerewolfTeamService


class InMemoryMemoryRepository(MemoryRepository):
    def __init__(self) -> None:
        self.states: dict[tuple[str, str], AgentMemoryState] = {}

    def save_state(self, state: AgentMemoryState) -> None:
        self.states[(state.game_id, state.ai_id)] = state.model_copy(deep=True)

    def load_state(self, game_id: str, ai_id: str) -> AgentMemoryState | None:
        state = self.states.get((game_id, ai_id))
        return state.model_copy(deep=True) if state else None

    def load_game(self, game_id: str) -> dict[str, AgentMemoryState]:
        return {
            ai_id: state.model_copy(deep=True)
            for (stored_game_id, ai_id), state in self.states.items()
            if stored_game_id == game_id
        }

    def initialize_states(self, game_id: str, ai_ids: list[str]) -> list[AgentMemoryState]:
        states: list[AgentMemoryState] = []
        for ai_id in ai_ids:
            key = (game_id, ai_id)
            if key not in self.states:
                self.states[key] = AgentMemoryState(gameId=game_id, aiId=ai_id)
            states.append(self.states[key].model_copy(deep=True))
        return states


class FakeLLMGateway:
    def __init__(self, responses: list[dict] | None = None, exc: Exception | None = None) -> None:
        self.responses = list(responses or [])
        self.exc = exc
        self.messages: list[list[dict[str, str]]] = []

    def generate_json(self, llm: LLMInvokeConfig, messages: list[dict[str, str]]) -> dict:
        self.messages.append(messages)
        if self.exc is not None:
            raise self.exc
        if not self.responses:
            raise AssertionError("FakeLLMGateway has no queued response")
        return self.responses.pop(0)


class FakeInvokeService:
    def __init__(self, targets_by_ai_id: dict[str, tuple[str | None, float]]) -> None:
        self.targets_by_ai_id = targets_by_ai_id
        self.seen_requests: list[AgentInvokeRequest] = []

    async def invoke_async(self, req: AgentInvokeRequest) -> AgentInvokeResult:
        self.seen_requests.append(req)
        target, confidence = self.targets_by_ai_id.get(req.ai_id, (None, 0.0))
        return AgentInvokeResult(
            requestId=req.request_id,
            gameId=req.game_id,
            aiId=req.ai_id,
            stage=req.stage,
            decision=AgentDecision(
                actionType="night_action",
                speechText=f"advice for {target}" if target else "no advice",
                skillType="pass",
                skillTarget=None,
                nightAction=NightActionPlan(
                    killTarget=target,
                    passReason="advice_only_human_wolf_decides",
                ),
                confidence=confidence,
                explain=["fake_wolf_advice"],
            ),
            suspicionScores=[],
            latencyMs=1,
            fallbackUsed=False,
            errorCode=None,
        )


def make_memory_service(max_window: int = 60) -> MemoryService:
    return MemoryService(InMemoryMemoryRepository(), max_window=max_window)


def make_llm_config() -> LLMInvokeConfig:
    return LLMInvokeConfig(
        provider="openai-compatible",
        modelName="fake-model",
        apiKey="test-key",
        baseUrl="http://unit.test/v1",
    )


def make_request(
    *,
    stage: InvokeStage = InvokeStage.SPEECH,
    role: str = "villager",
    ai_id: str = "ai_1",
    llm: LLMInvokeConfig | None = None,
    visible_events: list[dict] | None = None,
    alive_players: list[str] | None = None,
    candidate_targets: list[str] | None = None,
    private_vision: dict | None = None,
) -> AgentInvokeRequest:
    return AgentInvokeRequest(
        requestId=f"req-{ai_id}-{stage.value}",
        gameId="g1",
        aiId=ai_id,
        stage=stage,
        role=role,
        persona=PersonaType.LOGICAL,
        llm=llm if llm is not None else make_llm_config(),
        visibleEvents=visible_events or [],
        alivePlayers=alive_players or ["ai_1", "p1", "p2"],
        candidateTargets=candidate_targets or ["p1", "p2"],
        actualStage="day_speech",
        speechContext={"round": 1, "speechOrder": ["ai_1", "p1", "p2"]},
        selfSeat=3,
        selfDisplayName="AI Player 1",
        playerSeats={"ai_1": 3, "p1": 1, "p2": 2},
        playerDisplayNames={"ai_1": "AI Player 1", "p1": "Player 1", "p2": "Player 2"},
        privateVision=private_vision or {},
        asyncMode=False,
    )


def test_player_factory_generates_players_roles_and_llm_copies() -> None:
    service = PlayerFactoryService()
    response = service.generate_players(
        GeneratePlayersRequest(
            gameId="g1",
            roomId="r1",
            aiCount=3,
            modelPolicy={"provider": "openai", "modelName": "unit-model", "baseUrl": "http://unit.test/v1"},
        )
    )

    assert [player.ai_id for player in response.players] == ["ai_1", "ai_2", "ai_3"]
    assert [player.seat for player in response.players] == [1, 2, 3]
    assert all(player.game_id == "g1" and player.persona == PersonaType.LOGICAL for player in response.players)
    assert all(player.model_name == "unit-model" for player in response.players)

    role_response = service.assign_roles(
        "g1",
        [RoleAssignment(aiId="ai_1", role="werewolf"), RoleAssignment(aiId="ai_9", role="seer")],
    )
    assert [(item.ai_id, item.role) for item in role_response.assignments] == [("ai_1", "werewolf")]

    llm = service.get_llm_config("g1", "ai_1")
    assert llm is not None
    llm.model_name = "changed-in-test"
    assert service.get_llm_config("g1", "ai_1").model_name == "unit-model"


def test_memory_context_prompt_and_json_helpers() -> None:
    memory_service = make_memory_service(max_window=2)
    memory_service.ingest_visible_events(
        "g1",
        "ai_1",
        [
            {"eventType": "speech", "speaker": "p1", "content": "p1 talks first", "day": 1, "stage": 1},
            {"eventType": "vote", "speaker": "player2", "content": "vote target p1 is suspicious", "target": "p1"},
            {"eventType": "vote", "speaker": "player2", "content": "vote target p1 is suspicious", "target": "p1"},
            {"eventType": "speech", "speaker": "p1", "content": "p1 responds to pressure", "day": 1, "stage": 2},
        ],
        ["p1", "p2"],
    )
    state = memory_service.get_state("g1", "ai_1")
    assert state is not None
    assert len(state.memory_window) == 2
    assert state.suspicion_scores["p1"].score > state.suspicion_scores["p2"].score

    context = ContextAssembler().build_context(
        AgentProfile(
            ai_id="ai_1",
            game_id="g1",
            room_id="r1",
            seat=1,
            role="villager",
            persona=PersonaType.LOGICAL,
            model_provider="openai",
            model_name="unit-model",
        ),
        state,
        PersonaPolicy(persona=PersonaType.LOGICAL, speechRisk=0.5, voteVolatility=0.4, followGroup=0.45),
        ["ai_1", "p1", "p2"],
        {"known": "public enough"},
        1,
    )
    assert {"self", "alivePlayers", "memoryWindow", "suspicionScores", "personaPolicy", "currentStage"} <= set(context)

    invoke_service = InvokeService(FakeLLMGateway([]), memory_service)  # type: ignore[arg-type]
    prompt = invoke_service._build_prompt(
        make_request(
            role="villager",
            visible_events=[
                {
                    "speaker": "p1",
                    "content": "I suspect p2",
                    "role": "werewolf",
                    "nested": {"secretRole": "seer", "text": "visible detail"},
                }
            ],
            private_vision={"roleMap": {"p1": "werewolf"}, "selfSeat": 3},
        )
    )
    user_payload = json.loads(prompt[1]["content"])
    assert user_payload["role"] == "villager"
    assert user_payload["stage"] == "speech"
    assert user_payload["publicContext"]["selfSeat"] == 3
    assert user_payload["visibleEvents"][0]["nested"] == {"text": "visible detail"}
    assert "role" not in user_payload["visibleEvents"][0]
    assert user_payload["privateVision"] == {}
    assert "狼人杀" in prompt[0]["content"]

    assert normalize_role_name("狼人") == "werewolf"
    assert _extract_first_json('prefix ```json\n{"actionType":"speech"}\n``` suffix') == {"actionType": "speech"}
    with pytest.raises(ValueError):
        _extract_first_json("")


def test_invoke_generates_non_empty_speech_and_backend_format() -> None:
    gateway = FakeLLMGateway(
        [
            {
                "actionType": "speech",
                "speechText": "I am leaning p1 because their vote changed twice. I want p1 to explain that.",
                "voteTarget": "p1",
                "skillType": "kill",
                "skillTarget": "p2",
                "nightAction": {"killTarget": "p2"},
                "confidence": 0.72,
                "explain": ["public_vote_change"],
                "suspicionScores": [{"target": "p1", "score": 66, "reasons": ["vote_change"]}],
            }
        ]
    )
    memory_service = make_memory_service()
    result = InvokeService(gateway, memory_service).invoke(make_request(role="villager"))

    assert result.fallback_used is False
    assert result.decision.action_type == "speech"
    assert isinstance(result.decision.speech_text, str) and result.decision.speech_text.strip()
    assert result.decision.vote_target is None
    assert result.decision.skill_type is None
    assert result.decision.night_action is None
    assert result.suspicion_scores[0].target == "p1"
    assert result.model_dump(by_alias=True)["decision"]["actionType"] == "speech"
    assert memory_service.get_state("g1", "ai_1").last_decisions[-1]["actionType"] == "speech"


def test_werewolf_public_speech_does_not_expose_identity() -> None:
    gateway = FakeLLMGateway(
        [
            {
                "actionType": "speech",
                "speechText": "我是狼人，昨晚刀了 p1，我的狼队友会配合我。",
                "confidence": 0.9,
                "explain": ["leaked_identity"],
            }
        ]
    )
    result = InvokeService(gateway, make_memory_service()).invoke(make_request(role="werewolf"))

    assert result.decision.action_type == "speech"
    assert result.decision.speech_text.strip()
    forbidden = ["我是狼人", "昨晚刀", "狼队友", "privateVision"]
    assert not any(word in result.decision.speech_text for word in forbidden)


def test_empty_context_and_model_failure_use_fallbacks() -> None:
    empty_speech_gateway = FakeLLMGateway(
        [{"actionType": "speech", "speechText": "", "confidence": 0.2, "explain": []}]
    )
    empty_result = InvokeService(empty_speech_gateway, make_memory_service()).invoke(
        make_request(visible_events=[], alive_players=[], candidate_targets=[])
    )
    assert empty_result.decision.speech_text.strip()
    assert empty_result.decision.action_type == "speech"

    failing_gateway = FakeLLMGateway(exc=RuntimeError("model down"))
    failed_result = InvokeService(failing_gateway, make_memory_service()).invoke(
        make_request(stage=InvokeStage.VOTE, role="werewolf", private_vision={"wolfTeammates": ["w1"]}, candidate_targets=["w1", "p1"])
    )
    assert failed_result.fallback_used is True
    assert failed_result.error_code == "INVOKE_FAILED"
    assert failed_result.decision.vote_target == "p1"
    assert failed_result.decision.speech_text.strip()


def test_werewolf_night_action_uses_legal_target_and_consensus() -> None:
    gateway = FakeLLMGateway(
        [
            {
                "actionType": "night_action",
                "speechText": "",
                "skillType": "kill",
                "skillTarget": "w1",
                "nightAction": {"killTarget": "w1"},
                "confidence": 0.8,
                "explain": ["bad_teammate_target"],
            }
        ]
    )
    result = InvokeService(gateway, make_memory_service()).invoke(
        make_request(
            stage=InvokeStage.NIGHT_ACTION,
            role="werewolf",
            ai_id="w2",
            alive_players=["w1", "w2", "p1", "p2"],
            candidate_targets=["w1", "p1", "p2"],
            private_vision={"wolfTeammates": ["w1", "w2"], "consensusTarget": "p2", "forceConsensusTarget": True},
        )
    )

    assert result.decision.action_type == "night_action"
    assert result.decision.skill_type == "kill"
    assert result.decision.night_action.kill_target == "p2"
    assert result.decision.skill_target == "p2"


def test_multiple_ai_werewolves_build_non_conflicting_consensus() -> None:
    player_factory = PlayerFactoryService()
    player_factory.generate_players(
        GeneratePlayersRequest(
            gameId="g1",
            aiCount=3,
            modelPolicy={"provider": "openai", "modelName": "unit-model", "baseUrl": "http://unit.test/v1"},
        )
    )
    for ai_id in ["ai_1", "ai_2", "ai_3"]:
        player_factory.set_player_role("g1", ai_id, "werewolf")

    memory_service = make_memory_service()
    memory_service.initialize(InitMemoryRequest(gameId="g1", players=["ai_1", "ai_2", "ai_3"], asyncMode=False))
    fake_invoke = FakeInvokeService({"ai_1": ("p1", 0.7), "ai_2": ("p1", 0.6), "ai_3": ("p2", 0.9)})
    service = WerewolfTeamService(player_factory, fake_invoke, memory_service)  # type: ignore[arg-type]

    result = asyncio.run(
        service.build_night_consensus(
            WerewolfNightConsensusRequest(
                requestId="wolf-consensus-1",
                gameId="g1",
                werewolfAiIds=["ai_1", "ai_1", "ai_2", "ai_3"],
                alivePlayers=["ai_1", "ai_2", "ai_3", "p1", "p2"],
                candidateTargets=["ai_1", "ai_2", "p1", "p2"],
                privateVision={"wolfTeammates": ["ai_1", "ai_2", "ai_3"]},
            )
        )
    )

    assert result.werewolf_ai_ids == ["ai_1", "ai_2", "ai_3"]
    assert result.legal_targets == ["p1", "p2"]
    assert all(item.suggested_target in result.legal_targets for item in result.advice_results)
    assert result.consensus_target == "p1"
    assert result.final_kill_target == "p1"
    assert result.execution_decision.night_action.kill_target == "p1"
    assert set(result.consensus_recorded_ai_ids) == {"ai_1", "ai_2", "ai_3"}
    for ai_id in ["ai_1", "ai_2", "ai_3"]:
        decisions = memory_service.get_state("g1", ai_id).last_decisions
        assert decisions[-1]["stage"] == "night_consensus"
        assert decisions[-1]["consensusTarget"] == "p1"


def test_model_policy_accepts_camel_case_aliases() -> None:
    request = GeneratePlayersRequest(
        gameId="g1",
        aiCount=1,
        modelPolicy={"provider": "openai", "modelName": "unit-model", "baseUrl": "http://unit.test/v1"},
    )

    assert request.model_policy.model_name == "unit-model"
    assert request.model_policy.base_url == "http://unit.test/v1"


def test_player_factory_getters_return_deep_copies() -> None:
    service = PlayerFactoryService()
    service.generate_players(
        GeneratePlayersRequest(
            gameId="g1",
            aiCount=1,
            modelPolicy={"provider": "custom", "modelName": "copy-model", "baseUrl": "http://unit.test/v1"},
        )
    )

    player = service.get_player("g1", "ai_1")
    assert player is not None
    player.role = "werewolf"

    stored = service.get_player("g1", "ai_1")
    assert stored.role is None


def test_persona_policy_values_are_in_valid_range() -> None:
    for policy in PersonaService.DEFAULT_POLICIES.values():
        assert 0.0 <= policy.speech_risk <= 1.0
        assert 0.0 <= policy.vote_volatility <= 1.0
        assert 0.0 <= policy.follow_group <= 1.0


def test_persona_round_robin_assigns_stable_order() -> None:
    service = PersonaService()
    assignments = service.auto_assign_round_robin("g1", ["ai_1", "ai_2", "ai_3", "ai_4"])

    assert [item.persona for item in assignments] == [
        PersonaType.AGGRESSIVE,
        PersonaType.CONSERVATIVE,
        PersonaType.LOGICAL,
        PersonaType.AGGRESSIVE,
    ]


def test_persona_prompt_defaults_to_logical_for_empty_or_unknown() -> None:
    assert get_persona_prompt(None) == get_persona_prompt("logical")
    assert get_persona_prompt("unknown-style") == get_persona_prompt("logical")


@pytest.mark.parametrize(
    ("raw_role", "expected"),
    [
        ("wolf", "werewolf"),
        ("werewolf", "werewolf"),
        ("villagers", "villager"),
        ("seer", "seer"),
        ("witch", "witch"),
        ("hunter", "hunter"),
        (None, None),
    ],
)
def test_role_name_normalization(raw_role: str | None, expected: str | None) -> None:
    assert normalize_role_name(raw_role) == expected


def test_memory_initialize_creates_empty_states() -> None:
    memory_service = make_memory_service()
    response = memory_service.initialize(InitMemoryRequest(gameId="g1", players=["ai_1", "ai_2"], asyncMode=False))

    assert response.initialized == ["ai_1", "ai_2"]
    assert set(memory_service.get_game_states("g1")) == {"ai_1", "ai_2"}


def test_memory_ingest_visible_events_skips_empty_and_duplicate_events() -> None:
    memory_service = make_memory_service()
    state = memory_service.ingest_visible_events(
        "g1",
        "ai_1",
        [
            {"speaker": "p1", "content": ""},
            {"speaker": "p1", "content": "same public speech", "eventType": "speech"},
            {"speaker": "p1", "content": "same public speech", "eventType": "speech"},
        ],
    )

    assert len(state.memory_window) == 1
    assert state.memory_window[0].content == "same public speech"


def test_memory_record_decision_keeps_recent_twenty_items() -> None:
    memory_service = make_memory_service()
    for idx in range(25):
        memory_service.record_decision("g1", "ai_1", "stage", {"actionType": "speech", "idx": idx})

    state = memory_service.get_state("g1", "ai_1")
    assert len(state.last_decisions) == 20
    assert state.last_decisions[0]["idx"] == 5
    assert state.last_decisions[-1]["idx"] == 24


def test_memory_extracts_seer_checked_targets_from_decisions() -> None:
    memory_service = make_memory_service()
    memory_service.record_decision("g1", "ai_1", "night_action", {"nightAction": {"inspectTarget": "p1"}})
    memory_service.record_decision("g1", "ai_1", "night_action", {"skillType": "inspect", "skillTarget": "p2"})
    memory_service.record_decision("g1", "ai_1", "night_action", {"skillType": "inspect", "skillTarget": "p1"})

    assert memory_service.get_seer_checked_targets("g1", "ai_1") == ["p1", "p2"]


def test_context_assembler_outputs_expected_keys_and_aliases() -> None:
    profile = AgentProfile(
        ai_id="ai_1",
        game_id="g1",
        room_id="r1",
        seat=1,
        role="villager",
        persona=PersonaType.LOGICAL,
        model_provider="openai",
        model_name="unit-model",
    )
    memory_state = AgentMemoryState(gameId="g1", aiId="ai_1")
    policy = PersonaPolicy(persona=PersonaType.LOGICAL, speechRisk=0.5, voteVolatility=0.4, followGroup=0.45)

    context = ContextAssembler().build_context(profile, memory_state, policy, ["ai_1", "p1"], {}, 2)

    assert context["self"]["ai_id"] == "ai_1"
    assert context["alivePlayers"] == ["ai_1", "p1"]
    assert context["personaPolicy"]["speechRisk"] == 0.5
    assert context["currentStage"] == 2


def test_allowed_private_vision_keys_are_role_and_stage_specific() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]

    assert "wolfTeammates" in service._allowed_private_vision_keys(make_request(role="werewolf"), "werewolf")
    assert "nightDeathCandidate" in service._allowed_private_vision_keys(
        make_request(stage=InvokeStage.NIGHT_ACTION, role="witch"),
        "witch",
    )
    assert "hunterCanShoot" in service._allowed_private_vision_keys(
        make_request(stage=InvokeStage.DEATH_SHOT, role="hunter"),
        "hunter",
    )
    assert service._allowed_private_vision_keys(make_request(role="villager"), "villager") == set()


def test_private_vision_sanitizer_keeps_only_allowed_keys() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(
        role="werewolf",
        private_vision={
            "wolfTeammates": ["w1"],
            "allowFriendlyFire": False,
            "roleMap": {"p1": "seer"},
            "allRoles": {"p2": "witch"},
            "selfSeat": 3,
        },
    )

    sanitized = service._sanitize_private_vision_for_prompt(req, "werewolf")

    assert sanitized == {"wolfTeammates": ["w1"], "allowFriendlyFire": False}


def test_visible_event_sanitizer_removes_sensitive_fields_recursively() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(
        visible_events=[
            {
                "content": "public speech",
                "role": "werewolf",
                "nested": {"team": "wolf", "safe": "visible"},
                "items": [{"secretRole": "seer", "text": "public"}],
            }
        ]
    )

    sanitized = service._sanitize_visible_events_for_prompt(req)

    assert sanitized == [{"content": "public speech", "nested": {"safe": "visible"}, "items": [{"text": "public"}]}]


def test_public_context_can_fall_back_to_legacy_private_vision() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(
        private_vision={
            "actualStage": "legacy_stage",
            "isLastWords": True,
            "speechContext": {"direction": "forward"},
            "selfSeat": 8,
            "selfDisplayName": "Legacy Name",
            "playerSeats": {"ai_1": 8},
            "playerDisplayNames": {"ai_1": "Legacy Name"},
        }
    )

    public_context = service._public_context_from_request(req)

    assert public_context["actualStage"] == "day_speech"
    assert public_context["isLastWords"] is True
    assert public_context["speechContext"] == {"round": 1, "speechOrder": ["ai_1", "p1", "p2"]}
    assert public_context["selfSeat"] == 3
    assert public_context["selfDisplayName"] == "AI Player 1"


def test_fallback_public_speech_is_stage_specific_and_non_empty() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]

    assert service._fallback_public_speech(make_request(stage=InvokeStage.SPEECH)).strip()
    assert service._fallback_public_speech(make_request(stage=InvokeStage.VOTE)).strip()
    assert service._fallback_public_speech(make_request(stage=InvokeStage.DEATH_SHOT)).strip()
    assert service._fallback_public_speech(make_request(stage=InvokeStage.NIGHT_ACTION)) == ""


def test_internal_monologue_detector_flags_ai_and_werewolf_leaks() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]

    assert service._looks_like_internal_monologue(make_request(role="villager"), "我是AI玩家，我会推理。")
    assert service._looks_like_internal_monologue(make_request(role="werewolf"), "I am on the wolf team.")
    assert not service._looks_like_internal_monologue(make_request(role="villager"), "I want p1 to explain the vote.")


def test_prompt_contains_stage_role_public_context_and_candidate_targets() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]

    messages = service._build_prompt(make_request(role="werewolf", candidate_targets=["p1", "p2"]))
    payload = json.loads(messages[1]["content"])

    assert payload["stage"] == "speech"
    assert payload["role"] == "werewolf"
    assert payload["candidateTargets"] == ["p1", "p2"]
    assert payload["publicContext"]["speechContext"]["speechOrder"] == ["ai_1", "p1", "p2"]


def test_legal_targets_excluding_removes_only_excluded_players() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(candidate_targets=["w1", "p1", "p2"])

    assert service._legal_targets_excluding(req, ["w1", "missing"]) == ["p1", "p2"]


def test_normalize_night_action_maps_skill_type_to_action_fields() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(stage=InvokeStage.NIGHT_ACTION, role="werewolf")

    action = service._normalize_night_action(
        req,
        AgentDecision(actionType="night_action", skillType="kill", skillTarget="p1"),
    )

    assert action.kill_target == "p1"


def test_validate_vote_stage_corrects_invalid_target() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(stage=InvokeStage.VOTE, candidate_targets=["p1", "p2"])
    decision = AgentDecision(actionType="vote", speechText="vote", voteTarget="not_alive")

    validated = service._validate_decision(req, decision)

    assert validated.action_type == "vote"
    assert validated.vote_target == "p1"
    assert validated.skill_type is None


def test_validate_werewolf_vote_avoids_teammate_when_possible() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(
        stage=InvokeStage.VOTE,
        role="werewolf",
        candidate_targets=["w1", "p1"],
        private_vision={"wolfTeammates": ["w1"]},
    )
    decision = AgentDecision(actionType="vote", speechText="vote", voteTarget="w1")

    validated = service._validate_decision(req, decision)

    assert validated.vote_target == "p1"


def test_validate_seer_night_action_avoids_checked_targets() -> None:
    memory_service = make_memory_service()
    memory_service.record_decision("g1", "ai_1", "night_action", {"nightAction": {"inspectTarget": "p1"}})
    service = InvokeService(FakeLLMGateway([]), memory_service)  # type: ignore[arg-type]
    req = make_request(stage=InvokeStage.NIGHT_ACTION, role="seer", candidate_targets=["p1", "p2"])
    decision = AgentDecision(
        actionType="night_action",
        skillType="inspect",
        skillTarget="p1",
        nightAction=NightActionPlan(inspectTarget="p1"),
    )

    validated = service._validate_decision(req, decision)

    assert validated.skill_type == "inspect"
    assert validated.night_action.inspect_target == "p2"


def test_validate_witch_night_action_restricts_save_and_poison_targets() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(
        stage=InvokeStage.NIGHT_ACTION,
        role="witch",
        candidate_targets=["p1", "p2"],
        private_vision={"nightDeathCandidate": "p1", "antidoteAvailable": True, "poisonAvailable": True},
    )
    decision = AgentDecision(
        actionType="night_action",
        skillType="save_and_poison",
        skillTarget="p1",
        nightAction=NightActionPlan(saveTarget="p2", poisonTarget="p1"),
    )

    validated = service._validate_decision(req, decision)

    assert validated.night_action.save_target == "p1"
    assert validated.night_action.poison_target is None
    assert validated.skill_type == "antidote"


def test_validate_hunter_poison_death_blocks_shot() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(
        stage=InvokeStage.DEATH_SHOT,
        role="hunter",
        candidate_targets=["p1"],
        private_vision={"hunterCanShoot": True, "deathReason": "poison"},
    )
    decision = AgentDecision(actionType="death_shot", skillType="shoot", skillTarget="p1")

    validated = service._validate_decision(req, decision)

    assert validated.skill_type == "pass"
    assert validated.skill_target is None


def test_fallback_missing_llm_config_returns_invoke_failed() -> None:
    req = make_request(stage=InvokeStage.SPEECH)
    req = req.model_copy(update={"llm": None})

    result = InvokeService(FakeLLMGateway([]), make_memory_service()).invoke(
        req
    )

    assert result.fallback_used is True
    assert result.error_code == "INVOKE_FAILED"
    assert result.decision.speech_text.strip()


def test_json_extractor_reads_first_json_object_from_plain_text() -> None:
    assert _extract_first_json('before {"actionType":"vote","voteTarget":"p1"} after') == {
        "actionType": "vote",
        "voteTarget": "p1",
    }


def test_werewolf_team_helper_dedupes_ids_and_filters_teammates() -> None:
    player_factory = PlayerFactoryService()
    service = WerewolfTeamService(player_factory, FakeInvokeService({}), make_memory_service())  # type: ignore[arg-type]
    request = WerewolfNightConsensusRequest(
        requestId="r1",
        gameId="g1",
        werewolfAiIds=["ai_1"],
        alivePlayers=["ai_1", "ai_2", "p1"],
        candidateTargets=["ai_1", "ai_2", "p1", "p1"],
        privateVision={"wolfTeammates": ["ai_1", "ai_2"]},
    )

    assert service._dedupe_ids(["ai_1", "ai_1", "", "ai_2"]) == ["ai_1", "ai_2"]
    assert service._legal_targets(request, ["ai_1", "ai_2"]) == ["p1"]


def test_werewolf_team_base_private_vision_removes_stale_consensus() -> None:
    service = WerewolfTeamService(PlayerFactoryService(), FakeInvokeService({}), make_memory_service())  # type: ignore[arg-type]
    request = WerewolfNightConsensusRequest(
        requestId="r1",
        gameId="g1",
        werewolfAiIds=["ai_1"],
        privateVision={"consensusTarget": "old", "forceConsensusTarget": True, "wolfDecisionMode": "auto_execute", "x": 1},
    )

    private_vision = service._build_base_private_vision(request, ["ai_1"])

    assert private_vision == {"x": 1, "wolfTeammates": ["ai_1"]}


def test_werewolf_team_tie_detector_identifies_equal_top_scores() -> None:
    scores = [
        WerewolfConsensusScore(target="p1", recommendationCount=1, confidenceSum=0.5, score=100.5),
        WerewolfConsensusScore(target="p2", recommendationCount=1, confidenceSum=0.5, score=100.5),
    ]

    assert WerewolfTeamService._is_tie_broken_by_order(scores) is True


def test_memory_broadcast_event_does_not_duplicate_existing_event() -> None:
    memory_service = make_memory_service()
    event = AgentMemoryItem(eventType=EventType.SPEECH, speaker="p1", content="same broadcast")

    memory_service.broadcast_event("g1", ["ai_1"], event)
    response = memory_service.broadcast_event("g1", ["ai_1"], event)

    assert response.applied_ai_ids == ["ai_1"]
    assert len(response.states["ai_1"].memory_window) == 1


def test_validate_villager_night_action_returns_pass() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(stage=InvokeStage.NIGHT_ACTION, role="villager", candidate_targets=["p1"])
    decision = AgentDecision(actionType="night_action", skillType="kill", skillTarget="p1")

    validated = service._validate_decision(req, decision)

    assert validated.skill_type == "pass"
    assert validated.skill_target is None
    assert validated.night_action.pass_reason == "role_has_no_night_action"


def test_fallback_werewolf_night_action_chooses_non_teammate_target() -> None:
    service = InvokeService(FakeLLMGateway([]), make_memory_service())  # type: ignore[arg-type]
    req = make_request(
        stage=InvokeStage.NIGHT_ACTION,
        role="werewolf",
        candidate_targets=["w1", "p1"],
        private_vision={"wolfTeammates": ["w1"]},
    )

    result = service._fallback_result(req, latency_ms=1, error_code="INVOKE_FAILED")

    assert result.fallback_used is True
    assert result.decision.skill_type == "kill"
    assert result.decision.night_action.kill_target == "p1"


def test_werewolf_team_legal_targets_include_teammates_when_friendly_fire_allowed() -> None:
    service = WerewolfTeamService(PlayerFactoryService(), FakeInvokeService({}), make_memory_service())  # type: ignore[arg-type]
    request = WerewolfNightConsensusRequest(
        requestId="r1",
        gameId="g1",
        werewolfAiIds=["ai_1"],
        candidateTargets=["ai_1", "p1"],
        privateVision={"allowFriendlyFire": True},
    )

    assert service._legal_targets(request, ["ai_1"]) == ["ai_1", "p1"]
