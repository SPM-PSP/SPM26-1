#!/usr/bin/env python3
"""
AI replay service.

Provides HTTP endpoints for invoking the shared replay analyzer in ../utils.
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS


BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
UTILS_DIR = PROJECT_DIR / "utils"
DEFAULT_OUTPUT_DIR = BACKEND_DIR / "replay_analysis"


def _load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]

        os.environ.setdefault(key, value)


_load_env_file(BACKEND_DIR / ".env")

if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

try:
    from utils.ai_replayer import analyze_game_record
except ImportError as exc:
    print(f"Error: failed to import ai_replayer from {UTILS_DIR}: {exc}")
    sys.exit(1)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


def _resolve_output_dir(output_dir: str | None) -> str:
    if output_dir:
        return str(Path(output_dir).resolve())
    return str(DEFAULT_OUTPUT_DIR.resolve())


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify(
        {
            "status": "ok",
            "service": "ai_replay_service",
            "utils_dir": str(UTILS_DIR),
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.route("/analyze", methods=["POST"])
def analyze_game():
    try:
        data = request.get_json(silent=True)
        if not data or "game_record" not in data:
            return jsonify({"error": "missing required field: game_record"}), 400

        game_record = data["game_record"]
        ai_config = data.get("ai_config")
        output_dir = _resolve_output_dir(data.get("output_dir"))
        desensitize = data.get("desensitize", True)

        if not isinstance(game_record, dict):
            return jsonify({"error": "game_record must be a JSON object"}), 400

        if ai_config and isinstance(ai_config, dict) and "api_key_env" in ai_config:
            env_key = ai_config["api_key_env"]
            api_key = os.getenv(env_key)
            if api_key:
                ai_config = {**ai_config, "api_key": api_key}
            ai_config.pop("api_key_env", None)

        os.makedirs(output_dir, exist_ok=True)
        logger.info("Starting replay analysis. output_dir=%s", output_dir)

        result = analyze_game_record(
            game_record=game_record,
            ai_config=ai_config,
            output_dir=output_dir,
            desensitize=desensitize,
        )

        logger.info("Replay analysis completed: %s", result)
        return jsonify(
            {
                "success": True,
                "result": result,
                "timestamp": datetime.now().isoformat(),
            }
        )
    except Exception as exc:
        logger.exception("Replay analysis failed")
        return jsonify({"error": f"analysis failed: {exc}"}), 500


@app.route("/analyze_async", methods=["POST"])
def analyze_game_async():
    # Placeholder async endpoint; currently behaves the same as /analyze.
    return analyze_game()


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(_error):
    return jsonify({"error": "internal server error"}), 500


if __name__ == "__main__":
    os.makedirs(DEFAULT_OUTPUT_DIR, exist_ok=True)
    port = int(os.getenv("AI_REPLAY_PORT", "8002"))
    debug = os.getenv("AI_REPLAY_DEBUG", "false").lower() == "true"

    print("AI replay service starting...")
    print(f"port: {port}")
    print(f"debug: {debug}")
    print(f"utils_dir: {UTILS_DIR}")
    print(f"output_dir: {DEFAULT_OUTPUT_DIR}")
    print(f"health: http://localhost:{port}/health")
    print(f"analyze: http://localhost:{port}/analyze")

    app.run(host="0.0.0.0", port=port, debug=debug)
