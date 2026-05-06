# -*- coding: utf-8 -*-
"""LLM gateway with OpenAI-compatible request adapter."""

from __future__ import annotations

import json
import os
import re
from typing import Any

from openai import OpenAI

from ai_backend.ai_service.domain.models import LLMInvokeConfig

try:
    from ai_backend.config import config
except Exception:  # noqa: BLE001
    from config import config  # type: ignore


def _extract_first_json(text: str) -> dict[str, Any]:
    if not text:
        raise ValueError("empty model output")
    text = text.strip()
    decoder = json.JSONDecoder()
    for idx, ch in enumerate(text):
        if ch not in "{[":
            continue
        try:
            obj, _ = decoder.raw_decode(text[idx:])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            continue
    # 兜底：尝试从 markdown code block 中提取
    match = re.search(r"```json\s*(.*?)\s*```", text, flags=re.DOTALL)
    if match:
        obj = json.loads(match.group(1))
        if isinstance(obj, dict):
            return obj
    raise ValueError("no json object found in model output")


class LLMGateway:
    """Unified OpenAI-compatible caller."""

    HF_ROUTER_BASE = "https://router.huggingface.co/v1"
    DASHSCOPE_COMPAT_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    def _resolve_credentials(self, llm: LLMInvokeConfig) -> tuple[str, str | None]:
        provider = llm.provider.lower().strip()
        base_url = llm.base_url
        api_key = llm.api_key

        if provider in {"huggingface", "huggingface-router", "hf"}:
            base_url = base_url or self.HF_ROUTER_BASE
            api_key = api_key or os.getenv("HF_TOKEN") or ""
            return api_key, base_url

        if provider in {"qwen", "dashscope"}:
            base_url = base_url or self.DASHSCOPE_COMPAT_BASE
            api_key = api_key or config.dashscope_api_key or ""
            return api_key, base_url

        if provider in {"openai-compatible", "openai"}:
            base_url = base_url or config.openai_base_url
            api_key = api_key or config.openai_api_key or ""
            return api_key, base_url

        # 未识别provider时按openai兼容处理
        base_url = base_url or config.openai_base_url
        api_key = api_key or config.openai_api_key or ""
        return api_key, base_url

    def generate_json(self, llm: LLMInvokeConfig, messages: list[dict[str, str]]) -> dict[str, Any]:
        api_key, base_url = self._resolve_credentials(llm)
        if not api_key:
            raise ValueError("missing api_key for provider")

        client = OpenAI(api_key=api_key, base_url=base_url)
        completion = client.chat.completions.create(
            model=llm.model_name,
            messages=messages,
            temperature=llm.temperature,
            max_tokens=llm.max_tokens,
            response_format={"type": "json_object"},
            timeout=llm.timeout_seconds,
        )
        content = completion.choices[0].message.content or ""
        return _extract_first_json(content)

