"""
AI replay analysis module.

Responsibilities:
- Accept structured `game_record` data from the main backend.
- Call an LLM when available to produce a replay analysis.
- Fall back to heuristic analysis when AI is unavailable.
- Save both structured JSON output and a readable text report.
"""

from typing import Dict, Any, Optional, List
import os
import json
import logging
import re
from datetime import datetime

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

LOGGER = logging.getLogger(__name__)

ROLE_LABELS = {
    "wolf": "狼人",
    "predictor": "预言家",
    "witch": "女巫",
    "hunter": "猎人",
    "villager": "平民",
}


def _truncate_text(text: Any, max_len: int = 120) -> str:
    if text is None:
        return ""
    value = str(text).strip()
    if len(value) <= max_len:
        return value
    return value[: max_len - 3] + "..."


def _compact_players(game_record: Dict[str, Any]) -> List[Dict[str, Any]]:
    players = []
    final_players = game_record.get("final_result", {}).get("final_state", {}).get("players", {})
    if isinstance(final_players, dict) and final_players:
        for player_id, info in final_players.items():
            if not isinstance(info, dict):
                continue
            players.append(
                {
                    "player_id": player_id,
                    "name": info.get("name"),
                    "position": info.get("position"),
                    "role": info.get("role"),
                    "role_label": ROLE_LABELS.get(info.get("role"), info.get("role")),
                    "camp": info.get("camp_label", info.get("camp")),
                    "status": info.get("status"),
                    "out_reason": info.get("out_reason"),
                }
            )
        return players

    for item in game_record.get("players", [])[:12]:
        if not isinstance(item, dict):
            continue
        players.append(
            {
                "player_id": item.get("username"),
                "name": item.get("name"),
                "position": item.get("position"),
                "role": item.get("role"),
                "role_label": ROLE_LABELS.get(item.get("role"), item.get("role")),
                "camp": item.get("camp_label", item.get("camp")),
                "status": item.get("status_label", item.get("status")),
                "out_reason": item.get("out_reason"),
            }
        )
    return players


def _identity_roster(players: List[Dict[str, Any]]) -> List[str]:
    roster = []
    for player in players:
        position = player.get("position")
        name = player.get("name") or player.get("player_id")
        role = player.get("role_label") or player.get("role") or "未知身份"
        camp = player.get("camp")
        status = player.get("status")
        roster.append(f"{position}号 {name}: 真实身份={role}, 阵营={camp}, 最终状态={status}")
    return roster


def _compact_round_records(game_record: Dict[str, Any]) -> List[Dict[str, Any]]:
    compact_rounds = []
    for rr in game_record.get("round_records", [])[:8]:
        if not isinstance(rr, dict):
            continue

        speeches = []
        for sp in rr.get("speeches", [])[:6]:
            actor = sp.get("actor") or {}
            speeches.append(
                {
                    "speaker": actor.get("name") or actor.get("username"),
                    "text": _truncate_text(sp.get("text"), 100),
                }
            )

        actions = []
        for act in rr.get("actions", [])[:6]:
            actor = act.get("actor") or {}
            target = act.get("target") or {}
            actions.append(
                {
                    "action": act.get("action") or act.get("action_key"),
                    "actor": actor.get("name") or actor.get("username"),
                    "target": target.get("name") or target.get("username"),
                    "text": _truncate_text(act.get("text") or act.get("target_name") or "", 80),
                }
            )

        vote_results = rr.get("vote_results", {}) if isinstance(rr.get("vote_results"), dict) else {}
        compact_rounds.append(
            {
                "round": rr.get("round", rr.get("day")),
                "day": rr.get("day"),
                "vote_results": {
                    "vote_counts": vote_results.get("vote_counts", {}),
                    "voted_out_name": vote_results.get("voted_out_name"),
                },
                "speech_count": len(rr.get("speeches", [])),
                "action_count": len(rr.get("actions", [])),
                "vote_count": len(rr.get("votes", [])),
                "speech_samples": speeches,
                "action_samples": actions,
            }
        )
    return compact_rounds


def _compact_events(game_record: Dict[str, Any]) -> List[Dict[str, Any]]:
    compact_events = []
    for ev in game_record.get("events", [])[:20]:
        if not isinstance(ev, dict):
            continue
        data = ev.get("data", {}) if isinstance(ev.get("data"), dict) else {}
        compact_events.append(
            {
                "day": ev.get("day"),
                "stage": ev.get("stage"),
                "type": ev.get("type"),
                "text": _truncate_text(data.get("text") or data.get("content") or "", 100),
            }
        )
    return compact_events


def _compact_vote_records(game_record: Dict[str, Any]) -> List[Dict[str, Any]]:
    compact_votes = []
    for vote in game_record.get("vote_records", [])[:30]:
        if not isinstance(vote, dict):
            continue
        actor = vote.get("actor") or {}
        target = vote.get("target") or {}
        compact_votes.append(
            {
                "day": vote.get("day"),
                "stage": vote.get("stage"),
                "voter": actor.get("name") or actor.get("username"),
                "target": target.get("name") or target.get("username") or vote.get("target_name"),
                "vote_phase": vote.get("vote_phase"),
            }
        )
    return compact_votes


def _compact_player_logs(game_record: Dict[str, Any]) -> List[Dict[str, Any]]:
    compact_players = []
    player_logs = game_record.get("player_logs", {})
    if not isinstance(player_logs, dict):
        return compact_players

    for player_id, info in list(player_logs.items())[:12]:
        if not isinstance(info, dict):
            continue
        profile = info.get("profile", {}) if isinstance(info.get("profile"), dict) else {}

        speeches = []
        for item in info.get("speeches", [])[:3]:
            speeches.append(
                {
                    "day": item.get("day"),
                    "text": _truncate_text(item.get("text"), 90),
                }
            )

        votes_cast = []
        for item in info.get("votes_cast", [])[:4]:
            target = item.get("target") or {}
            votes_cast.append(
                {
                    "day": item.get("day"),
                    "target": target.get("name") or target.get("username") or item.get("target_name"),
                }
            )

        votes_received = []
        for item in info.get("votes_received", [])[:4]:
            actor = item.get("actor") or {}
            votes_received.append(
                {
                    "day": item.get("day"),
                    "from": actor.get("name") or actor.get("username"),
                }
            )

        actions = []
        for item in info.get("actions", [])[:4]:
            target = item.get("target") or {}
            actions.append(
                {
                    "day": item.get("day"),
                    "action": item.get("action") or item.get("action_key"),
                    "target": target.get("name") or target.get("username") or item.get("target_name"),
                    "text": _truncate_text(item.get("text") or "", 70),
                }
            )

        compact_players.append(
            {
                "player_id": player_id,
                "name": profile.get("name") or player_id,
                "position": profile.get("position"),
                "role": profile.get("role"),
                "role_label": ROLE_LABELS.get(profile.get("role"), profile.get("role")),
                "camp": profile.get("camp_label", profile.get("camp")),
                "status": profile.get("status_label", profile.get("status")),
                "speech_samples": speeches,
                "votes_cast": votes_cast,
                "votes_received": votes_received,
                "action_samples": actions,
            }
        )
    return compact_players


def _build_ai_input_record(game_record: Dict[str, Any], max_chars: int = 18000) -> Dict[str, Any]:
    players = _compact_players(game_record)
    compact = {
        "game_id": game_record.get("game_id"),
        "room_id": game_record.get("room_id"),
        "player_count": game_record.get("player_count"),
        "mode": game_record.get("mode"),
        "winner": game_record.get("winner_label", game_record.get("winner")),
        "days": game_record.get("days"),
        "game_stats": game_record.get("game_stats", {}),
        "identity_roster": _identity_roster(players),
        "players": players,
        "player_summaries": _compact_player_logs(game_record),
        "round_records": _compact_round_records(game_record),
        "vote_records_sample": _compact_vote_records(game_record),
        "event_samples": _compact_events(game_record),
    }

    raw = json.dumps(compact, ensure_ascii=False)
    if len(raw) <= max_chars:
        return compact

    for rr in compact.get("round_records", []):
        rr["speech_samples"] = rr.get("speech_samples", [])[:3]
        rr["action_samples"] = rr.get("action_samples", [])[:3]
        for sp in rr["speech_samples"]:
            sp["text"] = _truncate_text(sp.get("text"), 60)
        for act in rr["action_samples"]:
            act["text"] = _truncate_text(act.get("text"), 50)
    compact["event_samples"] = compact.get("event_samples", [])[:10]
    compact["vote_records_sample"] = compact.get("vote_records_sample", [])[:16]
    compact["player_summaries"] = compact.get("player_summaries", [])[:8]

    raw = json.dumps(compact, ensure_ascii=False)
    if len(raw) <= max_chars:
        return compact

    for rr in compact.get("round_records", []):
        rr.pop("speech_samples", None)
        rr.pop("action_samples", None)
    compact.pop("event_samples", None)
    compact.pop("vote_records_sample", None)
    return compact


def _desensitize(game_record: Dict[str, Any]) -> Dict[str, Any]:
    rec = json.loads(json.dumps(game_record))
    final_players = rec.get("final_result", {}).get("final_state", {}).get("players")
    if isinstance(final_players, dict):
        for _, info in final_players.items():
            if "ai_model" in info:
                info["ai_model"] = "REDACTED"

    for ev in rec.get("events", []):
        if ev.get("type") == "role_assignment" and "assignments" in ev:
            ev["assignments"] = {pid: "REDACTED" for pid in ev["assignments"].keys()}

    return rec


def _normalize_recommendation_item(item: Any) -> Dict[str, str]:
    if isinstance(item, str):
        return {
            "target": "待补充对象",
            "phase_or_round": "待补充阶段",
            "problem": item,
            "evidence": "待补充证据",
            "better_action": item,
            "expected_gain": "待补充收益",
        }

    if not isinstance(item, dict):
        text = str(item)
        return {
            "target": "待补充对象",
            "phase_or_round": "待补充阶段",
            "problem": text,
            "evidence": "待补充证据",
            "better_action": text,
            "expected_gain": "待补充收益",
        }

    return {
        "target": str(item.get("target") or item.get("player") or item.get("owner") or "待补充对象"),
        "phase_or_round": str(item.get("phase_or_round") or item.get("phase") or item.get("round") or "待补充阶段"),
        "problem": str(item.get("problem") or item.get("mistake") or item.get("issue") or "待补充问题"),
        "evidence": str(item.get("evidence") or item.get("basis") or item.get("reason") or "待补充证据"),
        "better_action": str(item.get("better_action") or item.get("suggestion") or item.get("task") or "待补充改进动作"),
        "expected_gain": str(item.get("expected_gain") or item.get("impact") or item.get("benefit") or "待补充预期收益"),
    }


def _normalize_recommendation_layers(raw_layers: Any, fallback_list: Any = None) -> Dict[str, List[Dict[str, str]]]:
    layers = {
        "player_specific": [],
        "team_coordination": [],
        "training_focus": [],
    }

    if isinstance(raw_layers, dict):
        for key in layers.keys():
            value = raw_layers.get(key, [])
            if isinstance(value, list):
                layers[key] = [_normalize_recommendation_item(item) for item in value]

    if not any(layers.values()) and isinstance(fallback_list, list):
        layers["training_focus"] = [_normalize_recommendation_item(item) for item in fallback_list]

    return layers


def _text_signature(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "")).lower()


def _dedupe_dict_items(items: Any, keys: List[str]) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []

    deduped: List[Dict[str, Any]] = []
    seen = set()
    for item in items:
        if not isinstance(item, dict):
            item = {"value": item}
        signature = tuple(_text_signature(item.get(key)) for key in keys)
        if not any(signature):
            signature = (_text_signature(json.dumps(item, ensure_ascii=False, sort_keys=True)),)
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append(item)
    return deduped


def _dedupe_recommendation_layers(layers: Dict[str, List[Dict[str, str]]]) -> Dict[str, List[Dict[str, str]]]:
    if not isinstance(layers, dict):
        return {"player_specific": [], "team_coordination": [], "training_focus": []}

    return {
        "player_specific": _dedupe_dict_items(layers.get("player_specific", []), ["target", "problem", "better_action"]),
        "team_coordination": _dedupe_dict_items(layers.get("team_coordination", []), ["target", "problem"]),
        "training_focus": _dedupe_dict_items(layers.get("training_focus", []), ["problem", "better_action"]),
    }


def _camp_name(value: Any) -> str:
    text = str(value or "")
    lower = text.lower()
    if "狼" in text or "wolf" in lower or "werewolf" in lower:
        return "狼人阵营"
    if (
        "好" in text
        or "民" in text
        or "seer" in lower
        or "witch" in lower
        or "hunter" in lower
        or "villager" in lower
        or "good" in lower
    ):
        return "好人阵营"
    return "未知阵营"


def _collect_player_profiles(game_record: Dict[str, Any]) -> List[Dict[str, Any]]:
    profiles: Dict[str, Dict[str, Any]] = {}

    for item in game_record.get("players", []):
        if not isinstance(item, dict):
            continue
        player_id = str(item.get("username") or item.get("player_id") or item.get("name") or "").strip()
        if not player_id:
            continue
        profiles[player_id] = {
            "player_id": player_id,
            "name": item.get("name") or player_id,
            "position": item.get("position"),
            "camp": _camp_name(item.get("camp_label", item.get("camp"))),
            "status": item.get("status_label", item.get("status")),
            "speeches": [],
            "actions": [],
            "votes_cast": [],
            "votes_received": [],
        }

    final_players = game_record.get("final_result", {}).get("final_state", {}).get("players", {})
    if isinstance(final_players, dict):
        for player_id, info in final_players.items():
            if not isinstance(info, dict):
                continue
            key = str(player_id)
            base = profiles.setdefault(
                key,
                {
                    "player_id": key,
                    "name": info.get("name") or key,
                    "position": info.get("position"),
                    "camp": _camp_name(info.get("camp_label", info.get("camp"))),
                    "status": info.get("status"),
                    "speeches": [],
                    "actions": [],
                    "votes_cast": [],
                    "votes_received": [],
                },
            )
            base["name"] = info.get("name") or base.get("name") or key
            base["position"] = info.get("position") or base.get("position")
            base["camp"] = _camp_name(info.get("camp_label", info.get("camp")) or base.get("camp"))
            base["status"] = info.get("status") or base.get("status")

    player_logs = game_record.get("player_logs", {})
    if isinstance(player_logs, dict):
        for player_id, entry in player_logs.items():
            if not isinstance(entry, dict):
                continue
            profile = entry.get("profile", {}) if isinstance(entry.get("profile"), dict) else {}
            key = str(player_id)
            base = profiles.setdefault(
                key,
                {
                    "player_id": key,
                    "name": profile.get("name") or key,
                    "position": profile.get("position"),
                    "camp": _camp_name(profile.get("camp_label", profile.get("camp"))),
                    "status": profile.get("status_label", profile.get("status")),
                    "speeches": [],
                    "actions": [],
                    "votes_cast": [],
                    "votes_received": [],
                },
            )
            base["name"] = profile.get("name") or base.get("name") or key
            base["position"] = profile.get("position") or base.get("position")
            if profile.get("camp_label") or profile.get("camp"):
                base["camp"] = _camp_name(profile.get("camp_label", profile.get("camp")))
            base["status"] = profile.get("status_label", profile.get("status")) or base.get("status")
            base["speeches"] = entry.get("speeches", []) if isinstance(entry.get("speeches"), list) else []
            base["actions"] = entry.get("actions", []) if isinstance(entry.get("actions"), list) else []
            base["votes_cast"] = entry.get("votes_cast", []) if isinstance(entry.get("votes_cast"), list) else []
            base["votes_received"] = (
                entry.get("votes_received", []) if isinstance(entry.get("votes_received"), list) else []
            )

    return list(profiles.values())


def _phase_label_from_profile(profile: Dict[str, Any]) -> str:
    days: List[int] = []
    for collection_name in ("speeches", "actions", "votes_cast", "votes_received"):
        for item in profile.get(collection_name, []):
            if not isinstance(item, dict):
                continue
            day = item.get("day")
            if isinstance(day, int) and day not in days:
                days.append(day)
    days.sort()
    if not days:
        return "全局复盘"
    if len(days) == 1:
        return f"第{days[0]}天"
    return f"第{days[0]}天至第{days[-1]}天"


def _build_profile_evidence(profile: Dict[str, Any]) -> str:
    name = profile.get("name") or profile.get("player_id") or "该玩家"
    speeches = profile.get("speeches", [])
    votes_cast = profile.get("votes_cast", [])
    votes_received = profile.get("votes_received", [])
    actions = profile.get("actions", [])

    pieces: List[str] = []
    if speeches:
        first_speech = speeches[0]
        pieces.append(
            f"{name}在第{first_speech.get('day', '?')}天发言“{_truncate_text(first_speech.get('text'), 36)}”"
        )
    if votes_cast:
        first_vote = votes_cast[0]
        target = first_vote.get("target_name")
        if not target and isinstance(first_vote.get("target"), dict):
            target = first_vote.get("target", {}).get("name") or first_vote.get("target", {}).get("username")
        pieces.append(f"曾在第{first_vote.get('day', '?')}天投票给{target or '某位玩家'}")
    if votes_received:
        pieces.append(f"累计被{len(votes_received)}次投票或重点关注")
    if actions:
        first_action = actions[0]
        target = first_action.get("target_name")
        if not target and isinstance(first_action.get("target"), dict):
            target = first_action.get("target", {}).get("name") or first_action.get("target", {}).get("username")
        pieces.append(
            f"进行过{first_action.get('action') or first_action.get('action_key') or '关键行动'}"
            + (f"并影响到{target}" if target else "")
        )
    if not pieces:
        pieces.append(f"{name}的公开行为记录较少，需要结合整局站边与投票再复盘")
    return "；".join(pieces[:3])


def _synthesize_player_specific_item(profile: Dict[str, Any]) -> Dict[str, str]:
    camp = profile.get("camp") or "未知阵营"
    position = str(profile.get("position") or "")
    name = profile.get("name") or profile.get("player_id") or "该玩家"
    target = f"{name}玩家"
    phase = _phase_label_from_profile(profile)
    evidence = _build_profile_evidence(profile)

    if "预言家" in position:
        problem = "信息公开与身份经营节奏仍可优化"
        better_action = "先建立可信度，再分层公开查验与站边依据，避免把正确信息一次性打完"
        expected_gain = "提高真信息被好人接受的概率，减少被狼人借势反打的空间"
    elif "女巫" in position:
        problem = "技能信息与白天发言之间的衔接还不够紧密"
        better_action = "在不暴露过度的前提下，及时把救药、毒药相关线索转化为白天讨论筹码"
        expected_gain = "让夜间收益真正转化为白天共识，提升好人阵营的信息效率"
    elif "猎人" in position:
        problem = "出局前后的局势判断需要更聚焦到最关键的嫌疑人"
        better_action = "在被推到出局边缘时，先复盘票型与带节奏点，再决定最后的反制对象"
        expected_gain = "减少误伤队友的风险，让猎人技能在关键轮次发挥最大价值"
    elif camp == "狼人阵营":
        problem = "需要把发言推进、票型承接和队友配合做成更完整的节奏链"
        better_action = "除了单点质疑，还要设计谁起势、谁承接、谁收票，避免推进节奏过于单薄"
        expected_gain = "让狼人阵营的优势不只依赖单个玩家爆发，而是形成更稳定的团队控制力"
    else:
        problem = "发言、站边与投票之间的联动还不够清晰"
        better_action = "每轮都明确说明自己为什么站边、准备投谁、又因什么证据改变判断"
        expected_gain = "提升普通好人的可读性与讨论价值，帮助阵营更快建立共识"

    return {
        "target": target,
        "phase_or_round": phase,
        "problem": problem,
        "evidence": evidence,
        "better_action": better_action,
        "expected_gain": expected_gain,
    }


def _ensure_player_specific_coverage(
    items: List[Dict[str, str]], game_record: Dict[str, Any]
) -> List[Dict[str, str]]:
    profiles = _collect_player_profiles(game_record)
    existing_targets = {
        str(item.get("target") or "").replace("角色训练", "").strip()
        for item in items
        if isinstance(item, dict)
    }
    normalized_items = [item for item in items if isinstance(item, dict)]

    for profile in profiles:
        base_name = str(profile.get("name") or profile.get("player_id") or "").strip()
        if not base_name:
            continue
        player_target = f"{base_name}玩家"
        if base_name in existing_targets or player_target in existing_targets:
            continue
        normalized_items.append(_synthesize_player_specific_item(profile))
    return normalized_items


def _build_team_coordination_defaults(game_record: Dict[str, Any]) -> List[Dict[str, str]]:
    winner = _camp_name(game_record.get("winner_label", game_record.get("winner")))
    defaults: List[Dict[str, str]] = []

    good_problem = (
        "关键信息没有形成稳定的共享与纠错机制"
        if winner == "狼人阵营"
        else "优势建立后仍需要更快完成收束与确认"
    )
    good_better = (
        "围绕预言家信息、女巫结果和票型变化建立统一的白天讨论主线"
        if winner == "狼人阵营"
        else "在拿到关键信息后尽快明确核心狼坑，避免把优势重新打散"
    )
    good_gain = (
        "减少真信息被质疑和浪费的概率，让好人阵营更快完成纠错"
        if winner == "狼人阵营"
        else "把已有优势转化为稳定胜势，减少临场摇摆带来的风险"
    )
    defaults.append(
        {
            "target": "好人阵营",
            "phase_or_round": "全局复盘",
            "problem": good_problem,
            "evidence": "从整局发言、投票和夜间行动看，好人方的信息接力与统一收束都不够稳定",
            "better_action": good_better,
            "expected_gain": good_gain,
        }
    )

    wolf_problem = (
        "虽然成功拿到胜势，但团队推进仍偏依赖关键狼玩家个人带节奏"
        if winner == "狼人阵营"
        else "未能持续掌控讨论方向和白天票型，团队协同深度不足"
    )
    wolf_better = (
        "继续强化谁起势、谁倒钩、谁收票的轮次分工，不把节奏压力集中在单个狼人身上"
        if winner == "狼人阵营"
        else "在关键轮次提前准备替代推进线，避免核心狼人被识破后全盘失速"
    )
    wolf_gain = (
        "让狼人阵营的控场能力更可复制，面对更强好人局时也能保持稳定推进"
        if winner == "狼人阵营"
        else "提高狼人阵营在逆风局中的续航和调整空间"
    )
    defaults.append(
        {
            "target": "狼人阵营",
            "phase_or_round": "全局复盘",
            "problem": wolf_problem,
            "evidence": "狼人方的优势主要体现在带节奏、制造分歧和承接投票的协作质量上",
            "better_action": wolf_better,
            "expected_gain": wolf_gain,
        }
    )
    return defaults


def _ensure_team_coordination_coverage(
    items: List[Dict[str, str]], game_record: Dict[str, Any]
) -> List[Dict[str, str]]:
    normalized_items = [item for item in items if isinstance(item, dict)]
    existing_targets = {str(item.get("target") or "").strip() for item in normalized_items}
    for default_item in _build_team_coordination_defaults(game_record):
        if default_item["target"] not in existing_targets:
            normalized_items.append(default_item)
    return normalized_items


def _flatten_recommendation_layers(layers: Dict[str, List[Dict[str, str]]]) -> List[str]:
    flat = []
    for key in ("player_specific", "team_coordination", "training_focus"):
        for item in layers.get(key, []):
            if not isinstance(item, dict):
                continue
            flat.append(
                f"{item.get('target', '对象')}：{item.get('problem', '问题')}。"
                f"更优做法：{item.get('better_action', '待补充')}。"
                f"预期收益：{item.get('expected_gain', '待补充')}。"
            )
    return flat[:6]


def _normalize_action_items(action_items: Any) -> List[Dict[str, str]]:
    normalized = []
    if not isinstance(action_items, list):
        return normalized

    for item in action_items:
        if isinstance(item, str):
            normalized.append(
                {
                    "owner": "复盘执行人",
                    "task": item,
                    "basis": "AI 复盘建议",
                    "deliverable": "完成对应复盘动作",
                }
            )
        elif isinstance(item, dict):
            normalized.append(
                {
                    "owner": str(item.get("owner") or item.get("target") or "复盘执行人"),
                    "task": str(item.get("task") or item.get("better_action") or item.get("action") or "待补充任务"),
                    "basis": str(item.get("basis") or item.get("evidence") or item.get("problem") or "待补充依据"),
                    "deliverable": str(item.get("deliverable") or item.get("expected_gain") or "待补充产出"),
                }
            )
    return normalized


def _normalize_analysis_result(raw_result: Dict[str, Any], game_record: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not isinstance(raw_result, dict):
        return raw_result

    recommendation_layers = _normalize_recommendation_layers(
        raw_result.get("recommendation_layers"),
        raw_result.get("strategy_recommendations"),
    )
    if game_record:
        recommendation_layers["player_specific"] = _ensure_player_specific_coverage(
            recommendation_layers.get("player_specific", []), game_record
        )
        recommendation_layers["team_coordination"] = _ensure_team_coordination_coverage(
            recommendation_layers.get("team_coordination", []), game_record
        )
    action_items_structured = _normalize_action_items(raw_result.get("action_items"))

    normalized = dict(raw_result)
    normalized["recommendation_layers"] = recommendation_layers
    normalized["strategy_recommendations"] = _flatten_recommendation_layers(recommendation_layers)
    normalized["action_items_structured"] = action_items_structured
    normalized["action_items"] = [
        f"{item['owner']} | {item['task']} | 依据：{item['basis']} | 产出：{item['deliverable']}"
        for item in action_items_structured
    ] or raw_result.get("action_items", [])
    normalized["narrative_report"] = str(
        raw_result.get("narrative_report") or raw_result.get("summary_report") or raw_result.get("summary") or ""
    ).strip()
    return normalized


def _extract_json_payload(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None

    stripped = text.strip()
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    match = re.search(r"```json\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
    if match:
        try:
            parsed = json.loads(match.group(1).strip())
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    decoder = json.JSONDecoder()
    for idx, char in enumerate(text):
        if char != "{":
            continue
        try:
            parsed, _ = decoder.raw_decode(text[idx:])
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            continue
    return None


def _build_text_report(analysis_result: Dict[str, Any]) -> str:
    lines = ["### 游戏复盘报告", ""]

    narrative = analysis_result.get("narrative_report")
    if narrative:
        lines.append(narrative)
        lines.append("")

    section_map = [
        ("player_specific", "个人改进建议"),
        ("team_coordination", "阵营协同建议"),
        ("training_focus", "训练重点"),
    ]
    layers = analysis_result.get("recommendation_layers", {})
    for key, title in section_map:
        items = layers.get(key, []) if isinstance(layers, dict) else []
        if not items:
            continue
        lines.append(f"### {title}")
        lines.append("")
        for item in items:
            lines.append(f"- 对象：{item.get('target', '待补充')}")
            lines.append(f"  问题：{item.get('problem', '待补充')}")
            lines.append(f"  证据：{item.get('evidence', '待补充')}")
            lines.append(f"  更优做法：{item.get('better_action', '待补充')}")
            lines.append(f"  预期收益：{item.get('expected_gain', '待补充')}")
        lines.append("")

    action_items = analysis_result.get("action_items", [])
    if action_items:
        lines.append("### 行动项")
        lines.append("")
        for item in action_items:
            lines.append(f"- {item}")
        lines.append("")

    return "\n".join(lines).strip() + "\n"

def _heuristic_analysis(game_record: Dict[str, Any]) -> Dict[str, Any]:
    analysis = {
        "vote_analysis": {},
        "skill_evaluation": {},
        "speech_issues": [],
        "mistakes": [],
        "recommendation_layers": {
            "player_specific": [],
            "team_coordination": [],
            "training_focus": [],
        },
        "strategy_recommendations": [],
        "action_items": [],
        "action_items_structured": [],
        "narrative_report": "",
    }

    rounds = []
    vote_freq: Dict[str, int] = {}
    for rr in game_record.get("round_records", []):
        vote_results = rr.get("vote_results", {}) if isinstance(rr.get("vote_results"), dict) else {}
        round_item = {
            "round": rr.get("round", rr.get("day")),
            "vote_counts": vote_results.get("vote_counts", {}),
            "voted_out": vote_results.get("voted_out_name"),
        }
        rounds.append(round_item)
        for player_id, count in round_item["vote_counts"].items():
            vote_freq[player_id] = vote_freq.get(player_id, 0) + int(count or 0)

    top_voted = sorted(vote_freq.items(), key=lambda item: item[1], reverse=True)[:5]
    analysis["vote_analysis"] = {
        "rounds": len(rounds),
        "top_voted": [{"player_id": player_id, "votes": count} for player_id, count in top_voted],
    }

    game_stats = game_record.get("game_stats", {})
    analysis["skill_evaluation"] = {
        "ability_uses": game_stats.get("ability_uses", 0),
        "total_deaths": game_stats.get("total_deaths", 0),
    }

    winner = _camp_name(game_record.get("winner_label", game_record.get("winner")))
    if winner == "狼人阵营":
        analysis["mistakes"].append("好人阵营没有把真实信息及时整合成统一共识，导致白天讨论持续失焦。")
    elif winner == "好人阵营":
        analysis["mistakes"].append("狼人阵营在关键轮次缺少持续承接与反扑，没能把分歧扩大成稳定优势。")

    analysis["recommendation_layers"]["player_specific"] = _ensure_player_specific_coverage([], game_record)
    analysis["recommendation_layers"]["team_coordination"] = _ensure_team_coordination_coverage([], game_record)
    analysis["recommendation_layers"]["training_focus"] = [
        {
            "target": "复盘训练",
            "phase_or_round": "全局训练",
            "problem": "需要把发言、站边、投票和夜间行动放在同一条时间线上联合复盘",
            "evidence": "仅看单句发言或单次投票，很难还原一局狼人杀里真正的节奏转折",
            "better_action": "按天整理关键发言、关键投票和关键技能使用，再复盘每次判断是如何形成的",
            "expected_gain": "帮助所有玩家更稳定地识别节奏点、共识点和误判来源",
        }
    ]

    analysis["action_items_structured"] = [
        {
            "owner": "全体玩家",
            "task": "按天整理关键发言、关键投票与技能使用顺序",
            "basis": "当前复盘最容易丢失的是信息如何一步步影响到白天共识",
            "deliverable": "一份带天数与阶段标记的整局时间线",
        },
        {
            "owner": "复盘组织者",
            "task": "为每名玩家补一条行为总结与下一局改进重点",
            "basis": "个人问题只有落到具体玩家，后续训练和前端展示才有持续价值",
            "deliverable": "全员个人建议清单",
        },
    ]
    analysis["action_items"] = [
        f"{item['owner']} | {item['task']} | 依据：{item['basis']} | 产出：{item['deliverable']}"
        for item in analysis["action_items_structured"]
    ]
    analysis["strategy_recommendations"] = _flatten_recommendation_layers(analysis["recommendation_layers"])
    analysis["narrative_report"] = (
        "本次启发式复盘重点关注投票走向、玩家公开行为以及阵营协同质量。"
        "即使没有成功调用大模型，也会尽量为每位玩家补出个人改进建议，并同时给出好人阵营与狼人阵营的总体复盘。"
    )
    return analysis


def _build_player_name_map(game_record: Dict[str, Any]) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for item in game_record.get("players", []):
        if not isinstance(item, dict):
            continue
        player_id = str(item.get("username") or item.get("player_id") or "").strip()
        player_name = str(item.get("name") or player_id).strip()
        if player_id:
            result[player_id] = player_name
        if player_name:
            result[player_name] = player_name
    final_players = game_record.get("final_result", {}).get("final_state", {}).get("players", {})
    if isinstance(final_players, dict):
        for player_id, info in final_players.items():
            if not isinstance(info, dict):
                continue
            player_name = str(info.get("name") or player_id).strip()
            result[str(player_id)] = player_name
            result[player_name] = player_name
    return result


def _split_sentences(text: Any) -> List[str]:
    raw = str(text or "").strip()
    if not raw:
        return []
    return [item.strip() for item in re.split(r"(?<=[。！？])\s*", raw) if item.strip()]


def _normalize_speech_issue_entry(item: Any, player_hint: str = "") -> Dict[str, str]:
    if isinstance(item, str):
        return {
            "player": player_hint or "未指定玩家",
            "phase_or_round": "待确认阶段",
            "issue": item,
            "evidence": item,
            "impact": "该发言可能影响场上对其身份与站边的判断。",
            "reason": item,
        }
    if not isinstance(item, dict):
        text = str(item)
        return {
            "player": player_hint or "未指定玩家",
            "phase_or_round": "待确认阶段",
            "issue": text,
            "evidence": text,
            "impact": "该发言可能影响场上对其身份与站边的判断。",
            "reason": text,
        }
    issue = str(item.get("issue") or item.get("problem") or item.get("excerpt") or item.get("text") or "").strip()
    evidence = str(item.get("evidence") or item.get("excerpt") or item.get("text") or issue).strip()
    impact = str(item.get("impact") or item.get("reason") or item.get("effect") or "该发言影响了场上判断方向。").strip()
    phase = str(item.get("phase_or_round") or item.get("phase") or item.get("round") or "待确认阶段").strip()
    player = str(item.get("player") or item.get("target") or player_hint or "未指定玩家").strip()
    return {
        "player": player,
        "phase_or_round": phase,
        "issue": issue or evidence,
        "evidence": evidence or issue,
        "impact": impact,
        "reason": impact,
    }


def _normalize_speech_issues(raw: Any, game_record: Dict[str, Any]) -> List[Dict[str, str]]:
    name_map = _build_player_name_map(game_record)
    normalized: List[Dict[str, str]] = []
    if isinstance(raw, list):
        return [_normalize_speech_issue_entry(item) for item in raw]
    if isinstance(raw, dict):
        for player_key, value in raw.items():
            player_name = name_map.get(str(player_key), str(player_key))
            normalized.append(_normalize_speech_issue_entry(value, player_name))
        return normalized
    if isinstance(raw, str):
        sentences = _split_sentences(raw)
        for sentence in sentences:
            match = re.search(r"(Player\d+|\d+号)", sentence)
            player_name = name_map.get(match.group(1), match.group(1)) if match else "全局"
            normalized.append(_normalize_speech_issue_entry(sentence, player_name))
        return normalized
    return normalized


def _normalize_skill_evaluation_entry(item: Any, player_hint: str = "", role_hint: str = "") -> Dict[str, str]:
    if isinstance(item, str):
        return {
            "player": player_hint or "未指定玩家",
            "role": role_hint or "待确认角色",
            "phase_or_round": "待确认阶段",
            "action": "关键技能或关键行动",
            "evaluation": item,
            "evidence": item,
        }
    if not isinstance(item, dict):
        text = str(item)
        return {
            "player": player_hint or "未指定玩家",
            "role": role_hint or "待确认角色",
            "phase_or_round": "待确认阶段",
            "action": "关键技能或关键行动",
            "evaluation": text,
            "evidence": text,
        }
    return {
        "player": str(item.get("player") or item.get("target") or player_hint or "未指定玩家").strip(),
        "role": str(item.get("role") or role_hint or "待确认角色").strip(),
        "phase_or_round": str(item.get("phase_or_round") or item.get("phase") or item.get("round") or "待确认阶段").strip(),
        "action": str(item.get("action") or item.get("skill") or item.get("event") or "关键技能或关键行动").strip(),
        "evaluation": str(item.get("evaluation") or item.get("issue") or item.get("summary") or item.get("text") or "").strip(),
        "evidence": str(item.get("evidence") or item.get("reason") or item.get("text") or item.get("evaluation") or "").strip(),
    }


def _normalize_skill_evaluation(raw: Any, game_record: Dict[str, Any]) -> List[Dict[str, str]]:
    name_map = _build_player_name_map(game_record)
    role_map = {
        str(profile.get("name") or profile.get("player_id")): str(profile.get("position") or "待确认角色")
        for profile in _collect_player_profiles(game_record)
    }
    normalized: List[Dict[str, str]] = []
    if isinstance(raw, list):
        return [_normalize_skill_evaluation_entry(item) for item in raw]
    if isinstance(raw, dict):
        if "ability_uses" in raw or "total_deaths" in raw:
            return [
                {
                    "player": "全局",
                    "role": "整局统计",
                    "phase_or_round": "全局复盘",
                    "action": "技能统计",
                    "evaluation": f"本局技能使用 {raw.get('ability_uses', 0)} 次，总死亡 {raw.get('total_deaths', 0)} 人。",
                    "evidence": "该结果来自启发式统计，而非逐角色技能复盘。",
                }
            ]
        for player_key, value in raw.items():
            player_name = name_map.get(str(player_key), str(player_key))
            normalized.append(
                _normalize_skill_evaluation_entry(value, player_name, role_map.get(player_name, "待确认角色"))
            )
        return normalized
    if isinstance(raw, str):
        sentences = _split_sentences(raw)
        for sentence in sentences:
            match = re.search(r"(Player\d+|\d+号)", sentence)
            player_name = name_map.get(match.group(1), match.group(1)) if match else "全局"
            normalized.append(
                _normalize_skill_evaluation_entry(sentence, player_name, role_map.get(player_name, "待确认角色"))
            )
        return normalized
    return normalized


def _normalize_mistake_entry(item: Any) -> Dict[str, str]:
    if isinstance(item, str):
        return {
            "target": "全局",
            "phase_or_round": "待确认阶段",
            "problem": item,
            "evidence": item,
            "consequence": "该误判影响了阵营判断与后续局势推进。",
            "better_action": "需要结合发言、票型和行动顺序重新复盘这一判断。",
        }
    if not isinstance(item, dict):
        text = str(item)
        return {
            "target": "全局",
            "phase_or_round": "待确认阶段",
            "problem": text,
            "evidence": text,
            "consequence": "该误判影响了阵营判断与后续局势推进。",
            "better_action": "需要结合发言、票型和行动顺序重新复盘这一判断。",
        }
    return {
        "target": str(item.get("target") or item.get("player") or "全局").strip(),
        "phase_or_round": str(item.get("phase_or_round") or item.get("phase") or item.get("round") or "待确认阶段").strip(),
        "problem": str(item.get("problem") or item.get("mistake") or item.get("issue") or "").strip(),
        "evidence": str(item.get("evidence") or item.get("reason") or item.get("basis") or "").strip(),
        "consequence": str(item.get("consequence") or item.get("impact") or "该误判影响了阵营判断与后续局势推进。").strip(),
        "better_action": str(item.get("better_action") or item.get("suggestion") or "需要结合复盘重新构建更稳的判断流程。").strip(),
    }


def _normalize_mistakes(raw: Any) -> List[Dict[str, str]]:
    if isinstance(raw, list):
        return [_normalize_mistake_entry(item) for item in raw]
    if isinstance(raw, dict):
        return [_normalize_mistake_entry(item) for item in raw.values()]
    if isinstance(raw, str):
        return [_normalize_mistake_entry(item) for item in _split_sentences(raw)]
    return []


def _fallback_vote_analysis(raw_result: Dict[str, Any], game_record: Dict[str, Any]) -> Any:
    vote_analysis = raw_result.get("vote_analysis")
    if vote_analysis not in (None, "", [], {}):
        return vote_analysis

    day_votes = {
        key: value
        for key, value in raw_result.items()
        if isinstance(key, str) and re.match(r"day\d+_votes$", key) and value not in (None, "", [], {})
    }
    if day_votes:
        return day_votes

    rounds = []
    for rr in game_record.get("round_records", []):
        vote_results = rr.get("vote_results", {}) if isinstance(rr, dict) and isinstance(rr.get("vote_results"), dict) else {}
        if vote_results:
            rounds.append(
                {
                    "round": rr.get("round", rr.get("day")),
                    "vote_counts": vote_results.get("vote_counts", {}),
                    "voted_out": vote_results.get("voted_out_name") or vote_results.get("voted_out"),
                }
            )
    return {"rounds": rounds} if rounds else {}


def _fallback_speech_issues(layers: Dict[str, List[Dict[str, str]]], raw_result: Dict[str, Any]) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []
    for item in layers.get("player_specific", [])[:6]:
        problem = str(item.get("problem") or "").strip()
        evidence = str(item.get("evidence") or "").strip()
        if not problem and not evidence:
            continue
        issues.append(
            {
                "player": str(item.get("target") or "未指定玩家").strip(),
                "phase_or_round": str(item.get("phase_or_round") or "全局复盘").strip(),
                "issue": problem or "发言、站边与投票之间缺少清晰联动",
                "evidence": evidence or problem,
                "impact": str(item.get("expected_gain") or raw_result.get("key_observations") or "影响场上对其身份与站边的判断").strip(),
                "reason": str(item.get("better_action") or problem or "").strip(),
            }
        )
    return issues


def _fallback_skill_evaluation(game_record: Dict[str, Any]) -> List[Dict[str, str]]:
    players = _compact_players(game_record)
    role_players = [
        player
        for player in players
        if player.get("role") in ("predictor", "witch", "hunter", "wolf")
    ]
    items: List[Dict[str, str]] = []
    for player in role_players:
        name = player.get("name") or player.get("player_id") or "未指定玩家"
        role = player.get("role_label") or player.get("role") or "待确认角色"
        items.append(
            {
                "player": str(name),
                "role": str(role),
                "phase_or_round": "全局复盘",
                "action": "角色行动与公开行为复盘",
                "evaluation": f"{role}需要结合夜间行动、白天发言和投票结果一起评估，重点看真实身份信息是否转化成阵营收益。",
                "evidence": f"{player.get('position')}号位，真实身份为{role}，最终状态为{player.get('status') or '未知'}。",
            }
        )
    if items:
        return items

    stats = game_record.get("game_stats", {}) if isinstance(game_record.get("game_stats"), dict) else {}
    return [
        {
            "player": "全局",
            "role": "整局统计",
            "phase_or_round": "全局复盘",
            "action": "技能统计",
            "evaluation": f"本局技能使用 {stats.get('ability_uses', 0)} 次，总死亡 {stats.get('total_deaths', 0)} 人。",
            "evidence": "该结果来自后端 game_stats 统计。",
        }
    ]


def _fallback_mistakes(
    raw_result: Dict[str, Any],
    layers: Dict[str, List[Dict[str, str]]],
) -> List[Dict[str, str]]:
    mistakes: List[Dict[str, str]] = []
    observation = str(raw_result.get("key_observations") or "").strip()
    if observation:
        mistakes.append(
            {
                "target": "全局",
                "phase_or_round": "关键轮次",
                "problem": observation,
                "evidence": observation,
                "consequence": "该问题影响了阵营判断与后续局势推进。",
                "better_action": "围绕投票、发言和夜间行动重新建立更稳定的信息链。",
            }
        )

    for item in layers.get("team_coordination", [])[:2]:
        problem = str(item.get("problem") or "").strip()
        if not problem:
            continue
        mistakes.append(
            {
                "target": str(item.get("target") or "阵营协同").strip(),
                "phase_or_round": str(item.get("phase_or_round") or "全局复盘").strip(),
                "problem": problem,
                "evidence": str(item.get("evidence") or problem).strip(),
                "consequence": str(item.get("expected_gain") or "阵营协同质量下降，关键信息难以及时收束").strip(),
                "better_action": str(item.get("better_action") or "明确轮次分工和信息收束方式").strip(),
            }
        )
    return mistakes


def _fallback_action_items(
    raw_result: Dict[str, Any],
    layers: Dict[str, List[Dict[str, str]]],
) -> List[Dict[str, str]]:
    action_items = _normalize_action_items(raw_result.get("action_items_structured"))
    if action_items:
        return action_items

    seed_items = layers.get("training_focus", []) + layers.get("team_coordination", [])[:2]
    result: List[Dict[str, str]] = []
    for item in seed_items[:4]:
        result.append(
            {
                "owner": str(item.get("target") or "复盘执行人"),
                "task": str(item.get("better_action") or item.get("problem") or "整理关键发言、票型和技能使用时间线"),
                "basis": str(item.get("evidence") or item.get("problem") or "来自本局复盘建议"),
                "deliverable": str(item.get("expected_gain") or "形成下一局可执行的改进清单"),
            }
        )
    if result:
        return result

    return [
        {
            "owner": "复盘组织者",
            "task": "按天整理关键发言、关键投票和关键技能使用顺序",
            "basis": "当前复盘需要还原信息如何影响白天共识",
            "deliverable": "一份带天数和阶段标记的时间线",
        },
        {
            "owner": "全体玩家",
            "task": "每人补充一条下一局可执行的站边或投票改进点",
            "basis": "个人建议需要落到玩家身上才方便训练",
            "deliverable": "全员个人改进清单",
        },
    ]


def _fallback_training_focus(layers: Dict[str, List[Dict[str, str]]]) -> None:
    if layers.get("training_focus"):
        return
    layers["training_focus"] = [
        {
            "target": "发言训练",
            "phase_or_round": "白天发言",
            "problem": "发言需要同时说明身份判断、票型依据和下一步投票意向。",
            "evidence": "本局多名玩家的发言与投票理由没有稳定闭环。",
            "better_action": "每轮发言固定输出“我信谁、怀疑谁、准备投谁、依据是什么”。",
            "expected_gain": "减少临场摇摆，让阵营更容易形成共识。",
        },
        {
            "target": "票型复盘",
            "phase_or_round": "投票阶段",
            "problem": "需要把每一票和上一轮发言对应起来复盘。",
            "evidence": "投票结果直接改变出局顺序，是判断阵营协同质量的关键证据。",
            "better_action": "记录每名玩家投票目标、投票理由和是否跟随关键节奏位。",
            "expected_gain": "更快识别误推、冲票、倒钩和带节奏行为。",
        },
    ]


def _normalize_analysis_result(raw_result: Dict[str, Any], game_record: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not isinstance(raw_result, dict):
        return raw_result

    recommendation_layers = _normalize_recommendation_layers(
        raw_result.get("recommendation_layers"),
        raw_result.get("strategy_recommendations"),
    )
    if game_record:
        recommendation_layers["player_specific"] = _ensure_player_specific_coverage(
            recommendation_layers.get("player_specific", []), game_record
        )
        recommendation_layers["team_coordination"] = _ensure_team_coordination_coverage(
            recommendation_layers.get("team_coordination", []), game_record
        )
    _fallback_training_focus(recommendation_layers)
    recommendation_layers = _dedupe_recommendation_layers(recommendation_layers)

    action_items_structured = _normalize_action_items(raw_result.get("action_items"))
    if not action_items_structured:
        action_items_structured = _fallback_action_items(raw_result, recommendation_layers)
    action_items_structured = _dedupe_dict_items(action_items_structured, ["owner", "task", "basis"])
    normalized = dict(raw_result)
    normalized["vote_analysis"] = _fallback_vote_analysis(raw_result, game_record or {})
    normalized["recommendation_layers"] = recommendation_layers
    normalized["strategy_recommendations"] = _flatten_recommendation_layers(recommendation_layers)
    normalized["action_items_structured"] = action_items_structured
    normalized["action_items"] = [
        f"{item['owner']} | {item['task']} | 依据：{item['basis']} | 产出：{item['deliverable']}"
        for item in action_items_structured
    ] or raw_result.get("action_items", [])
    normalized["speech_issues"] = _dedupe_dict_items(
        _normalize_speech_issues(raw_result.get("speech_issues"), game_record or {}),
        ["player", "phase_or_round", "issue", "evidence"],
    )
    if not normalized["speech_issues"]:
        normalized["speech_issues"] = _fallback_speech_issues(recommendation_layers, raw_result)
    normalized["skill_evaluation"] = _dedupe_dict_items(
        _normalize_skill_evaluation(raw_result.get("skill_evaluation"), game_record or {}),
        ["player", "phase_or_round", "action", "evidence"],
    )
    if not normalized["skill_evaluation"]:
        normalized["skill_evaluation"] = _fallback_skill_evaluation(game_record or {})
    normalized["mistakes"] = _dedupe_dict_items(
        _normalize_mistakes(raw_result.get("mistakes")),
        ["target", "phase_or_round", "problem", "evidence"],
    )
    if not normalized["mistakes"]:
        normalized["mistakes"] = _fallback_mistakes(raw_result, recommendation_layers)
    normalized["narrative_report"] = str(
        raw_result.get("narrative_report") or raw_result.get("summary_report") or raw_result.get("summary") or ""
    ).strip()
    if not normalized["narrative_report"]:
        observation = str(raw_result.get("key_observations") or "").strip()
        normalized["narrative_report"] = observation or (
            "本局复盘重点关注投票走向、公开发言和技能使用如何共同影响阵营判断，"
            "并为每位玩家补出下一局可执行的改进方向。"
        )
    return normalized


def _heuristic_analysis(game_record: Dict[str, Any]) -> Dict[str, Any]:
    profiles = _collect_player_profiles(game_record)
    vote_freq: Dict[str, int] = {}
    rounds = []
    for rr in game_record.get("round_records", []):
        vote_results = rr.get("vote_results", {}) if isinstance(rr.get("vote_results"), dict) else {}
        vote_counts = vote_results.get("vote_counts", {})
        rounds.append(
            {
                "round": rr.get("round", rr.get("day")),
                "vote_counts": vote_counts,
                "voted_out": vote_results.get("voted_out_name"),
            }
        )
        for player_id, count in vote_counts.items():
            vote_freq[player_id] = vote_freq.get(player_id, 0) + int(count or 0)

    top_voted = sorted(vote_freq.items(), key=lambda item: item[1], reverse=True)[:5]
    name_map = _build_player_name_map(game_record)
    speech_issues = []
    skill_items = []

    for profile in profiles:
        player_name = str(profile.get("name") or profile.get("player_id") or "未指定玩家")
        phase = _phase_label_from_profile(profile)
        speeches = profile.get("speeches", [])
        actions = profile.get("actions", [])
        votes_cast = profile.get("votes_cast", [])
        position = str(profile.get("position") or "待确认角色")

        if speeches:
            first_speech = speeches[0]
            speech_text = _truncate_text(first_speech.get("text"), 50)
            speech_issues.append(
                {
                    "player": player_name,
                    "phase_or_round": phase,
                    "issue": "公开发言与后续站边/投票之间的逻辑链还需要更清晰。",
                    "evidence": f"{player_name}在第{first_speech.get('day', '?')}天发言“{speech_text}”。",
                    "impact": "如果发言依据不够清晰，后续很容易被带入他人设计的讨论框架。",
                    "reason": "如果发言依据不够清晰，后续很容易被带入他人设计的讨论框架。",
                }
            )

        if actions:
            first_action = actions[0]
            target_name = first_action.get("target_name")
            if not target_name and isinstance(first_action.get("target"), dict):
                target_name = first_action.get("target", {}).get("name") or first_action.get("target", {}).get("username")
            skill_items.append(
                {
                    "player": player_name,
                    "role": position,
                    "phase_or_round": phase,
                    "action": str(first_action.get("action") or first_action.get("action_key") or "关键行动"),
                    "evaluation": "该玩家有过关键行动，但仍需要结合白天信息承接来判断收益是否最大化。",
                    "evidence": f"{player_name}执行过{first_action.get('action') or first_action.get('action_key') or '关键行动'}"
                    + (f"，目标为{target_name}" if target_name else ""),
                }
            )
        else:
            skill_items.append(
                {
                    "player": player_name,
                    "role": position,
                    "phase_or_round": phase,
                    "action": "公开行为复盘",
                    "evaluation": "该玩家没有明显技能记录，复盘重点应放在发言、站边与投票判断上。",
                    "evidence": f"{player_name}主要通过公开发言和投票参与局势推进。",
                }
            )

    mistakes = []
    winner = str(game_record.get("winner_label") or game_record.get("winner") or "")
    if "wolf" in winner.lower() or "狼" in winner:
        mistakes.append(
            {
                "target": "好人阵营",
                "phase_or_round": "全局复盘",
                "problem": "好人阵营没有把关键信息及时整合成稳定共识。",
                "evidence": "从投票分布和关键角色出局路径看，场上纠错速度明显慢于误导扩散速度。",
                "consequence": "白天讨论持续失焦，导致狼人更容易掌控节奏。",
                "better_action": "围绕查验、救药、票型和关键发言建立统一复盘线索，再决定白天主推对象。",
            }
        )
    else:
        mistakes.append(
            {
                "target": "狼人阵营",
                "phase_or_round": "全局复盘",
                "problem": "狼人阵营没有把局部优势持续承接成终局胜势。",
                "evidence": "关键轮次的投票与发言承接不够稳定，无法持续放大好人阵营分歧。",
                "consequence": "即使制造过摇摆，也没能形成稳定控场。",
                "better_action": "提前设计起势、承接和收票分工，避免节奏只靠单人推进。",
            }
        )

    analysis = {
        "vote_analysis": {
            "rounds": len(rounds),
            "top_voted": [{"player_id": player_id, "player": name_map.get(player_id, player_id), "votes": count} for player_id, count in top_voted],
        },
        "skill_evaluation": skill_items,
        "speech_issues": speech_issues,
        "mistakes": mistakes,
        "recommendation_layers": {
            "player_specific": _ensure_player_specific_coverage([], game_record),
            "team_coordination": _ensure_team_coordination_coverage([], game_record),
            "training_focus": [
                {
                    "target": "复盘训练",
                    "phase_or_round": "全局训练",
                    "problem": "需要把发言、站边、投票和夜间行动放在同一条时间线上联合复盘。",
                    "evidence": "仅看单句发言或单次投票，很难还原一局狼人杀里真正的节奏转折。",
                    "better_action": "按天整理关键发言、关键投票和关键技能使用，再复盘每次判断如何形成。",
                    "expected_gain": "帮助所有玩家更稳定地识别节奏点、共识点和误判来源。",
                }
            ],
        },
        "strategy_recommendations": [],
        "action_items": [],
        "action_items_structured": [
            {
                "owner": "全体玩家",
                "task": "按天整理关键发言、关键投票与技能使用顺序",
                "basis": "当前复盘最容易丢失的是信息如何一步步影响到白天共识",
                "deliverable": "一份带天数与阶段标记的整局时间线",
            },
            {
                "owner": "复盘组织者",
                "task": "为每名玩家补一条行为总结与下一局改进重点",
                "basis": "个人问题只有落到具体玩家，后续训练和前端展示才有持续价值",
                "deliverable": "全员个人建议清单",
            },
        ],
        "narrative_report": (
            "本次启发式复盘重点关注投票走向、玩家公开行为以及阵营协同质量。"
            "即使没有成功调用大模型，也会尽量为每位玩家补出个人改进建议，并同时给出好人阵营与狼人阵营的总体复盘。"
        ),
    }
    analysis["action_items"] = [
        f"{item['owner']} | {item['task']} | 依据：{item['basis']} | 产出：{item['deliverable']}"
        for item in analysis["action_items_structured"]
    ]
    analysis["strategy_recommendations"] = _flatten_recommendation_layers(analysis["recommendation_layers"])
    return analysis


def analyze_game_record(
    game_record: Dict[str, Any],
    ai_config: Optional[Dict[str, Any]] = None,
    output_dir: str = "test_analysis",
    desensitize: bool = True,
) -> Dict[str, str]:
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    record_to_use = game_record
    if desensitize:
        try:
            record_to_use = _desensitize(game_record)
        except Exception as exc:
            LOGGER.warning("Desensitization failed, using original record: %s", exc)
            record_to_use = game_record

    ai_available = OpenAI is not None and ai_config and (ai_config.get("api_key") or ai_config.get("api_key_env"))
    analysis_result = None

    if ai_available:
        try:
            api_key = ai_config.get("api_key")
            baseurl = ai_config.get("baseurl")
            model = ai_config.get("model") or "gpt-4"
            client = OpenAI(api_key=api_key, base_url=baseurl)

            ai_input_record = _build_ai_input_record(record_to_use)
            LOGGER.info(
                "AI replay compact input prepared. original_chars=%s compact_chars=%s",
                len(json.dumps(record_to_use, ensure_ascii=False)),
                len(json.dumps(ai_input_record, ensure_ascii=False)),
            )
           
            player_names = [
                player.get("name") or player.get("player_id")
                for player in ai_input_record.get("players", [])
                if isinstance(player, dict) and (player.get("name") or player.get("player_id"))
            ]
            system = (
                "你是一名狼人杀复盘教练。"
                "请严格返回 JSON 对象，不要输出 Markdown、不要输出代码块、不要输出额外解释。"
                "除玩家名称、角色英文名和 evidence 中的原始发言引用外，所有 JSON 字段值必须使用简体中文。"
                "如果原始发言是英文，evidence 可以保留英文原文；但 issue、impact、evaluation、problem、consequence、better_action、expected_gain、narrative_report 必须使用中文。"
                "顶层必须包含：vote_analysis, speech_issues, skill_evaluation, mistakes, "
                "recommendation_layers, strategy_recommendations, action_items, narrative_report。"
                "各字段必须分工明确，禁止把同一条分析原封不动重复写进多个字段。"
                "vote_analysis 只分析票型和出局结果；speech_issues 只分析发言问题；skill_evaluation 只分析角色技能和关键行动；mistakes 只写影响胜负的误判。"
                "recommendation_layers 只写下一局怎么改，不能复述 mistakes 的完整句子；action_items 只把最重要建议转成可执行任务，不能复制 recommendation_layers 原文。"
                "speech_issues 必须是数组，每项包含：player, phase_or_round, issue, evidence, impact。"
                "skill_evaluation 必须是数组，每项包含：player, role, phase_or_round, action, evaluation, evidence。"
                "mistakes 必须是数组，每项包含：target, phase_or_round, problem, evidence, consequence, better_action。"
                "recommendation_layers 必须是对象，且包含 player_specific, team_coordination, training_focus 三个数组。"
                "recommendation_layers 中每条建议都必须包含：target, phase_or_round, problem, evidence, better_action, expected_gain。"
                "player_specific 必须尽量覆盖所有玩家，每名玩家最多 1 条，尤其不能漏掉平民玩家和狼人玩家。"
                "team_coordination 必须至少包含两条总体分析，target 必须分别严格写为“好人阵营”和“狼人阵营”，不要写 Good camp 或 Wolf camp。"
                "training_focus 只保留 2 到 4 条最值得训练的重点。"
                "strategy_recommendations 只保留 3 到 6 条最强建议，用中文自然语言概括。"
                "action_items 必须是结构化数组，每项包含 owner, task, basis, deliverable，字段值必须使用中文。"
                "narrative_report 控制在 120 到 220 个中文字符，概括整局关键转折与核心问题。"
                "identity_roster 和 players 字段中的 position、role、role_label、camp、status 是本局结束后的权威事实。"
                "分析时必须完全服从这些事实，不得改写、猜测、反转或把玩家发言中的跳身份当成真实身份。"
                "如果发言内容与 identity_roster 冲突，必须判断为该玩家话术、诈身份或误导，而不是修改真实身份。"
            )
           
            user_prompt = (
                "请基于下面这份狼人杀结构化对局数据生成复盘。\n"
                "最重要：identity_roster 是唯一真实身份表，发言中自称的身份只是话术。\n"
                f"1. player_specific 必须尽量覆盖以下每位玩家，各至少给出 1 条建议：{', '.join(player_names)}。\n"
                "2. speech_issues 不能只写一句泛化评价，要指出玩家、阶段、具体问题、引用证据和造成的影响。\n"
                "3. skill_evaluation 不能只写“使用得好/不好”，要写清行动、阶段、评价与证据。\n"
                "4. mistakes 不能只列结论，要写清是谁或哪一方、发生在哪个阶段、为什么是误判、后果是什么。\n"
                "5. team_coordination 中必须同时包含好人阵营和狼人阵营的总体分析。\n"
                "6. 如果某玩家证据较少，也请基于已有发言、投票和行动样本给出保守但明确的判断。\n"
                "7. 同一事实只能在最适合的栏目详细分析一次，其他栏目如需引用只能一句话概括，不能换个说法重复展开。\n"
                "8. 输出前自检所有 player、role、camp 是否与 identity_roster 完全一致；若发言自称身份冲突，按话术处理。\n"
                "\n对局 JSON：\n"
                + json.dumps(ai_input_record, ensure_ascii=False)
            )

            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt},
                ],
            )
            if resp and hasattr(resp, "choices"):
                raw_text = resp.choices[0].message.content
                parsed = _extract_json_payload(raw_text)
                if parsed is not None:
                    analysis_result = _normalize_analysis_result(parsed, record_to_use)
                else:
                    LOGGER.warning("AI output could not be parsed as JSON. Falling back to heuristic analysis.")
                    analysis_result = _heuristic_analysis(game_record)
            else:
                analysis_result = _heuristic_analysis(game_record)
        except Exception as exc:
            LOGGER.error("AI replay call failed, using heuristic fallback: %s", exc)
            analysis_result = _heuristic_analysis(game_record)
    else:
        LOGGER.info("AI unavailable or not configured, using heuristic analysis")
        analysis_result = _heuristic_analysis(game_record)

    json_out = os.path.join(output_dir, f"ai_replay_{timestamp}.json")
    try:
        with open(json_out, "w", encoding="utf-8") as file_obj:
            json.dump(analysis_result, file_obj, ensure_ascii=False, indent=2)
        LOGGER.info("Analysis JSON saved: %s", json_out)
    except Exception as exc:
        LOGGER.error("Failed to save analysis JSON: %s", exc)

    txt_out = os.path.join(output_dir, f"ai_replay_{timestamp}.txt")
    try:
        with open(txt_out, "w", encoding="utf-8") as file_obj:
            file_obj.write(_build_text_report(analysis_result))
        LOGGER.info("Analysis text saved: %s", txt_out)
    except Exception as exc:
        LOGGER.error("Failed to save analysis text: %s", exc)

    return {"json": json_out, "text": txt_out}


if __name__ == "__main__":
    sample = "test_analysis/sample_game_record.json"
    if os.path.exists(sample):
        with open(sample, "r", encoding="utf-8") as file_obj:
            sample_record = json.load(file_obj)
        analyze_game_record(sample_record, ai_config=None)
    else:
        print("Module ready: call analyze_game_record(game_record, ai_config, output_dir).")
