# -*- coding: utf-8 -*-
"""AI player generation service."""

from __future__ import annotations

from threading import Lock

from ai_backend.ai_service.domain.enums import PersonaType
from ai_backend.ai_service.domain.models import (
    AgentProfile,
    AssignRolesResponse,
    GeneratePlayersRequest,
    GeneratePlayersResponse,
    LLMInvokeConfig,
    RoleAssignment,
)

try:
    from ai_backend.config import config
except Exception:  # noqa: BLE001
    from config import config  # type: ignore


class PlayerFactoryService:
    """Create AI player profiles and bind server-side LLM configs per game."""

    def __init__(self):
        self._game_players: dict[str, list[AgentProfile]] = {}
        self._game_llm_configs: dict[str, dict[str, LLMInvokeConfig]] = {}
        self._lock = Lock()

    def _resolve_model(self, request: GeneratePlayersRequest) -> tuple[str, str, str | None]:
        policy = request.model_policy
        if policy and policy.provider:
            provider = str(policy.provider)
            model_name = policy.model_name or self._default_model_name(provider)
            return provider, model_name, policy.base_url

        provider = str(config.model_provider)
        model_name = self._default_model_name(provider)
        base_url = None
        if provider == "openai":
            base_url = config.openai_base_url
        return provider, model_name, base_url

    def _default_model_name(self, provider: str) -> str:
        if provider == "openai":
            return config.openai_model_name
        if provider == "dashscope":
            return config.dashscope_model_name
        if provider == "ollama":
            return config.ollama_model_name
        return "unknown-model"

    def _resolve_llm_configs(self, request: GeneratePlayersRequest) -> list[LLMInvokeConfig]:
        policy = request.model_policy
        provider, model_name, base_url = self._resolve_model(request)

        if provider == "openai" and config.openai_player_mode == "per-player":
            source_configs = config.openai_player_configs

            resolved: list[LLMInvokeConfig] = []
            for idx in range(request.ai_count):
                item = source_configs[idx % len(source_configs)]
                resolved.append(
                    LLMInvokeConfig(
                        provider="openai",
                        modelName=policy.model_name if policy and policy.model_name else item["model_name"],
                        apiKey=item["api_key"],
                        baseUrl=policy.base_url if policy and policy.base_url else item["base_url"],
                    )
                )
            return resolved

        api_key: str | None = None
        if provider == "openai":
            api_key = config.openai_api_key
        elif provider == "dashscope":
            api_key = config.dashscope_api_key

        shared = LLMInvokeConfig(
            provider=provider,
            modelName=model_name,
            apiKey=api_key,
            baseUrl=base_url,
        )
        return [shared.model_copy(deep=True) for _ in range(request.ai_count)]

    def generate_players(self, request: GeneratePlayersRequest) -> GeneratePlayersResponse:
        llm_configs = self._resolve_llm_configs(request)
        players: list[AgentProfile] = []
        bound_llms: dict[str, LLMInvokeConfig] = {}

        for idx in range(request.ai_count):
            ai_id = f"ai_{idx + 1}"
            llm = llm_configs[idx]
            players.append(
                AgentProfile(
                    ai_id=ai_id,
                    game_id=request.game_id,
                    room_id=request.room_id,
                    seat=idx + 1,
                    persona=PersonaType.LOGICAL,
                    model_provider=llm.provider,
                    model_name=llm.model_name,
                    model_base_url=llm.base_url,
                )
            )
            bound_llms[ai_id] = llm

        with self._lock:
            self._game_players[request.game_id] = players
            self._game_llm_configs[request.game_id] = bound_llms

        return GeneratePlayersResponse(
            gameId=request.game_id,
            roomId=request.room_id,
            players=players,
        )

    def get_players(self, game_id: str) -> list[AgentProfile]:
        with self._lock:
            return [profile.model_copy(deep=True) for profile in self._game_players.get(game_id, [])]

    def get_player(self, game_id: str, ai_id: str) -> AgentProfile | None:
        with self._lock:
            for profile in self._game_players.get(game_id, []):
                if profile.ai_id == ai_id:
                    return profile.model_copy(deep=True)
        return None

    def get_llm_config(self, game_id: str, ai_id: str) -> LLMInvokeConfig | None:
        with self._lock:
            game_configs = self._game_llm_configs.get(game_id, {})
            llm = game_configs.get(ai_id)
            return llm.model_copy(deep=True) if llm else None

    def set_player_persona(self, game_id: str, ai_id: str, persona: PersonaType) -> None:
        with self._lock:
            players = self._game_players.get(game_id, [])
            for profile in players:
                if profile.ai_id == ai_id:
                    profile.persona = persona
                    break

    def set_player_role(self, game_id: str, ai_id: str, role: str) -> None:
        with self._lock:
            players = self._game_players.get(game_id, [])
            for profile in players:
                if profile.ai_id == ai_id:
                    profile.role = role
                    break

    def assign_roles(self, game_id: str, assignments: list[RoleAssignment]) -> AssignRolesResponse:
        with self._lock:
            players = {profile.ai_id: profile for profile in self._game_players.get(game_id, [])}
            applied: list[RoleAssignment] = []
            for item in assignments:
                profile = players.get(item.ai_id)
                if profile is None:
                    continue
                profile.role = item.role
                applied.append(RoleAssignment(aiId=item.ai_id, role=item.role))

        return AssignRolesResponse(gameId=game_id, assignments=applied)
