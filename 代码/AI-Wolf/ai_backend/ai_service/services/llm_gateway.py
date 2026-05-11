# -*- coding: utf-8 -*-
"""LLM gateway supporting OpenAI-compatible APIs and local HF models."""

from __future__ import annotations

import json
import os
import re
from threading import Lock
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

    match = re.search(r"```json\s*(.*?)\s*```", text, flags=re.DOTALL)
    if match:
        obj = json.loads(match.group(1))
        if isinstance(obj, dict):
            return obj
    raise ValueError("no json object found in model output")


def _coerce_message_content(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
                continue
            if isinstance(item, dict):
                text = item.get("text") or item.get("content")
                if isinstance(text, str):
                    parts.append(text)
                continue

            text = getattr(item, "text", None)
            if isinstance(text, str):
                parts.append(text)
                continue

            nested_text = getattr(text, "value", None)
            if isinstance(nested_text, str):
                parts.append(nested_text)
        return "\n".join(part for part in parts if part)
    return str(content)


class LLMGateway:
    """Unified caller for remote APIs and local transformers models."""

    HF_ROUTER_BASE = "https://router.huggingface.co/v1"
    DASHSCOPE_COMPAT_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ZHIPU_COMPAT_BASE = "https://open.bigmodel.cn/api/paas/v4/"

    def __init__(self) -> None:
        self._local_model_cache: dict[str, tuple[Any, Any]] = {}
        self._local_model_lock = Lock()

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

        if provider in {"zhipu", "glm", "bigmodel"}:
            base_url = base_url or config.zhipu_base_url or self.ZHIPU_COMPAT_BASE
            api_key = api_key or config.zhipu_api_key or ""
            return api_key, base_url

        if provider in {"openai-compatible", "openai"}:
            base_url = base_url or config.openai_base_url
            api_key = api_key or config.openai_api_key or ""
            return api_key, base_url

        if provider == "ollama":
            base_url = base_url or config.ollama_base_url
            api_key = api_key or "ollama"
            return api_key, base_url

        base_url = base_url or config.openai_base_url
        api_key = api_key or config.openai_api_key or ""
        return api_key, base_url

    def _resolve_torch_dtype(self, dtype_name: str | None = None) -> Any:
        import torch

        dtype_name = (dtype_name or config.local_hf_dtype or "auto").lower()
        mapping = {
            "float16": torch.float16,
            "fp16": torch.float16,
            "bfloat16": torch.bfloat16,
            "bf16": torch.bfloat16,
            "float32": torch.float32,
            "fp32": torch.float32,
        }
        return mapping.get(dtype_name, "auto")

    def _normalize_quantization_mode(self) -> str:
        quantization = (config.local_hf_quantization or "none").strip().lower()
        if quantization in {"", "none", "off", "false", "no"}:
            return "none"
        if quantization in {"4bit", "8bit"}:
            return quantization
        raise ValueError(f"unsupported LOCAL_HF_QUANTIZATION: {config.local_hf_quantization}")

    def _is_cuda_device(self, device: str) -> bool:
        return device == "cuda" or device.startswith("cuda:")

    def _resolve_device_map(self, runtime_device: str) -> Any | None:
        if runtime_device == "cuda":
            return "auto"
        if runtime_device.startswith("cuda:"):
            try:
                return {"": int(runtime_device.split(":", 1)[1])}
            except ValueError:
                return "auto"
        return None

    def _resolve_local_runtime_device(self) -> str:
        try:
            import torch
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise RuntimeError("local_hf provider requires torch to be installed") from exc

        requested = (config.local_hf_device or "auto").strip().lower()
        has_cuda = torch.cuda.is_available()

        if self._is_cuda_device(requested):
            if not has_cuda:
                raise RuntimeError(f"LOCAL_HF_DEVICE={requested} but CUDA is not available")
            return requested

        if requested == "auto":
            return "cuda" if has_cuda else "cpu"

        return requested or "cpu"

    def _build_quantization_config(self) -> Any | None:
        quantization = self._normalize_quantization_mode()
        if quantization == "none":
            return None

        runtime_device = self._resolve_local_runtime_device()
        if not self._is_cuda_device(runtime_device):
            raise RuntimeError(
                "Quantized local_hf loading requires CUDA. "
                "Set LOCAL_HF_DEVICE=auto/cuda on a GPU machine, or disable LOCAL_HF_QUANTIZATION."
            )

        try:
            from transformers import BitsAndBytesConfig
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise RuntimeError(
                "LOCAL_HF_QUANTIZATION is enabled but bitsandbytes support is unavailable. "
                "Install transformers + bitsandbytes first."
            ) from exc

        if quantization == "8bit":
            return BitsAndBytesConfig(load_in_8bit=True)

        compute_dtype = self._resolve_torch_dtype(config.local_hf_quant_compute_dtype)
        if compute_dtype == "auto":
            import torch

            compute_dtype = torch.float16

        return BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=compute_dtype,
            bnb_4bit_quant_type=config.local_hf_quant_type,
            bnb_4bit_use_double_quant=config.local_hf_use_double_quant,
        )

    def _local_model_cache_key(self, model_path: str) -> str:
        return "|".join(
            [
                model_path,
                config.local_hf_device,
                config.local_hf_dtype,
                self._normalize_quantization_mode(),
                config.local_hf_quant_type,
                config.local_hf_quant_compute_dtype,
                str(config.local_hf_use_double_quant).lower(),
            ]
        )

    def _resolve_model_input_device(self, model: Any) -> Any:
        try:
            embeddings = model.get_input_embeddings()
            if embeddings is not None and hasattr(embeddings, "weight"):
                return embeddings.weight.device
        except Exception:  # noqa: BLE001
            pass

        try:
            return next(model.parameters()).device
        except Exception:  # noqa: BLE001
            return getattr(model, "device", "cpu")

    def _load_local_model(self, model_path: str) -> tuple[Any, Any]:
        with self._local_model_lock:
            cache_key = self._local_model_cache_key(model_path)
            cached = self._local_model_cache.get(cache_key)
            if cached is not None:
                return cached

            try:
                from transformers import AutoModelForCausalLM, AutoTokenizer
            except ImportError as exc:  # pragma: no cover - dependency guard
                raise RuntimeError(
                    "local_hf provider requires transformers/torch to be installed"
                ) from exc

            tokenizer = AutoTokenizer.from_pretrained(
                model_path,
                trust_remote_code=config.local_hf_trust_remote_code,
            )

            runtime_device = self._resolve_local_runtime_device()
            quantization_config = self._build_quantization_config()
            model_kwargs: dict[str, Any] = {
                "trust_remote_code": config.local_hf_trust_remote_code,
                "low_cpu_mem_usage": True,
            }
            torch_dtype = self._resolve_torch_dtype()
            if quantization_config is not None:
                model_kwargs["quantization_config"] = quantization_config
            elif torch_dtype != "auto":
                model_kwargs["torch_dtype"] = torch_dtype

            device_map = self._resolve_device_map(runtime_device)
            if device_map is not None:
                model_kwargs["device_map"] = device_map

            model = AutoModelForCausalLM.from_pretrained(
                model_path,
                **model_kwargs,
            )

            if not self._is_cuda_device(runtime_device):
                model = model.to(runtime_device)

            model.eval()
            self._local_model_cache[cache_key] = (tokenizer, model)
            return tokenizer, model

    def _generate_json_local_hf(
        self,
        llm: LLMInvokeConfig,
        messages: list[dict[str, str]],
    ) -> dict[str, Any]:
        model_path = llm.base_url or config.local_hf_model_path
        if not model_path:
            raise ValueError("missing local model path for local_hf provider")

        tokenizer, model = self._load_local_model(model_path)

        try:
            import torch
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise RuntimeError("local_hf provider requires torch to be installed") from exc

        prompt_text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = tokenizer(prompt_text, return_tensors="pt")
        input_device = self._resolve_model_input_device(model)
        inputs = {key: value.to(input_device) for key, value in inputs.items()}
        temperature = llm.temperature if llm.temperature is not None else 0

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                do_sample=temperature > 0,
                temperature=max(temperature, 1e-5),
                max_new_tokens=llm.max_tokens,
                pad_token_id=tokenizer.eos_token_id,
            )

        generated = outputs[0][inputs["input_ids"].shape[-1]:]
        content = tokenizer.decode(generated, skip_special_tokens=True)
        return _extract_first_json(content)

    def generate_json(self, llm: LLMInvokeConfig, messages: list[dict[str, str]]) -> dict[str, Any]:
        provider = llm.provider.lower().strip()
        if provider == "local_hf":
            return self._generate_json_local_hf(llm, messages)

        api_key, base_url = self._resolve_credentials(llm)
        if not api_key:
            raise ValueError("missing api_key for provider")

        client = OpenAI(api_key=api_key, base_url=base_url)
        request_kwargs: dict[str, Any] = {
            "model": llm.model_name,
            "messages": messages,
            "temperature": llm.temperature,
            "max_tokens": llm.max_tokens,
            "timeout": llm.timeout_seconds,
        }
        if provider != "ollama":
            request_kwargs["response_format"] = {"type": "json_object"}
        if provider in {"zhipu", "glm", "bigmodel"}:
            # Our invoke flow expects a short JSON decision, so disable default thinking
            # on GLM-4.5-class models to avoid spending output tokens on reasoning only.
            request_kwargs["extra_body"] = {"thinking": {"type": "disabled"}}

        completion = client.chat.completions.create(**request_kwargs)
        choice = completion.choices[0]
        message = choice.message
        content = _coerce_message_content(getattr(message, "content", None))
        if not content:
            finish_reason = getattr(choice, "finish_reason", None)
            reasoning = getattr(message, "reasoning_content", None)
            refusal = getattr(message, "refusal", None)
            details: list[str] = []
            if finish_reason:
                details.append(f"finish_reason={finish_reason}")
            if reasoning:
                details.append("reasoning_content_present=true")
            if refusal:
                details.append(f"refusal={refusal}")
            extra = f" ({', '.join(details)})" if details else ""
            raise ValueError(f"empty model output{extra}")
        return _extract_first_json(content)
