"""
AI 复盘模块

职责：
- 接收结构化的 `game_record`（游戏日志数据），并基于 AI（若可用）生成复盘分析报告和策略总结；
- 在无 AI 环境下提供启发式（规则）分析作为降级方案；
- 严格按输入输出要求保存分析结果：
  输入：游戏日志数据（dict）
  输出：分析报告（文本）及结构化策略总结（JSON）

使用方法示例：
    from utils.ai_replayer import analyze_game_record
    analyze_game_record(game_record, ai_config=ai_cfg, output_dir='test_analysis')

注意：ai_config 可为空或 None（此时使用启发式分析）。
"""

from typing import Dict, Any, Optional
import os
import json
import logging
from datetime import datetime

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

LOGGER = logging.getLogger(__name__)


def _desensitize(game_record: Dict[str, Any]) -> Dict[str, Any]:
    rec = json.loads(json.dumps(game_record))
    # 脱敏 players 中的 role 与 ai_model 字段
    if isinstance(rec.get('final_result', {}).get('final_state', {}).get('players'), dict):
        for pid, info in rec['final_result']['final_state']['players'].items():
            if 'role' in info:
                info['role'] = 'REDACTED'
            if 'ai_model' in info:
                info['ai_model'] = 'REDACTED'

    # 脱敏 events 中的角色分配
    for ev in rec.get('events', []):
        if ev.get('type') == 'role_assignment' and 'assignments' in ev:
            ev['assignments'] = {pid: 'REDACTED' for pid in ev['assignments'].keys()}

    return rec


def _heuristic_analysis(game_record: Dict[str, Any]) -> Dict[str, Any]:
    """在没有 AI 时的降级分析：统计票型、简单技能统计与建议。"""
    analysis = {
        'vote_analysis': {},
        'skill_evaluation': {},
        'speech_issues': [],
        'mistakes': [],
        'strategy_recommendations': [],
        'action_items': []
    }

    # 投票统计：从 round_records 或 game_stats.votes 提取
    votes = []
    for rr in game_record.get('round_records', []):
        vr = rr.get('vote_results')
        if isinstance(vr, dict):
            vote_counts = vr.get('vote_counts', {})
            votes.append({'round': rr.get('round'), 'vote_counts': vote_counts, 'voted_out': vr.get('voted_out_name')})

    # fallback: game_stats.votes list
    if not votes and game_record.get('game_stats', {}).get('votes'):
        votes = [{'round': None, 'vote_counts': {}, 'voted_out': None}]
        # aggregate minimal info

    analysis['vote_analysis']['rounds'] = len(votes)
    # 计算出现被投出较多的玩家
    freq = {}
    for v in votes:
        for pid, cnt in v.get('vote_counts', {}).items():
            freq[pid] = freq.get(pid, 0) + int(cnt or 0)
    top = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:5]
    analysis['vote_analysis']['top_voted'] = [{'player_id': p, 'votes': c} for p, c in top]

    # 技能统计（基于 game_stats 记录）
    gs = game_record.get('game_stats', {})
    analysis['skill_evaluation']['ability_uses'] = gs.get('ability_uses', 0)
    analysis['skill_evaluation']['total_deaths'] = gs.get('total_deaths', 0)

    # 简要建议
    if analysis['vote_analysis']['top_voted']:
        analysis['strategy_recommendations'].append('关注高票玩家的发言与站队，寻找一致投票者。')
    if analysis['skill_evaluation']['ability_uses'] < 1:
        analysis['strategy_recommendations'].append('尝试更积极地利用特殊技能以获取信息优势。')

    analysis['action_items'] = [
        '导出高票玩家的发言时间轴以供人工复核。',
        '统计各玩家的发言次数与被点次数，优先审查高频项。'
    ]
    return analysis


def analyze_game_record(game_record: Dict[str, Any], ai_config: Optional[Dict[str, Any]] = None,
                        output_dir: str = 'test_analysis', desensitize: bool = True) -> Dict[str, str]:
    """主入口：基于 AI（若可用）生成复盘报告。

    Args:
        game_record: 完整的结构化游戏记录（dict）。
        ai_config: 可选的AI配置，示例 {"api_key": "xxx", "model": "gpt-4", "baseurl": "..."}
        output_dir: 输出目录
        desensitize: 是否先对记录进行脱敏后再传给AI

    Returns:
        dict 包含生成文件路径：{"json": <path>, "text": <path>}。
    """
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # 准备记录副本
    record_to_use = game_record
    if desensitize:
        try:
            record_to_use = _desensitize(game_record)
        except Exception as e:
            LOGGER.warning(f"脱敏过程发生错误，使用原始记录：{e}")
            record_to_use = game_record

    # 如果 AI 可用且提供了 api_key，则优先调用 AI
    ai_available = OpenAI is not None and ai_config and (ai_config.get('api_key') or ai_config.get('api_key_env'))
    analysis_result = None
    ai_text = None

    if ai_available:
        try:
            api_key = ai_config.get('api_key')
            baseurl = ai_config.get('baseurl')
            model = ai_config.get('model') or 'gpt-4'
            client = OpenAI(api_key=api_key, base_url=baseurl)

            # 构造提示，要求返回 JSON（限定格式）并且给出简洁的策略总结
            system = (
                "你是一名资深狼人杀教练和数据分析师。读取下面的结构化游戏记录，输出严格的JSON，包含字段："
                "vote_analysis, speech_issues, skill_evaluation, mistakes, strategy_recommendations, action_items。"
                "同时生成一段可读的短报告（不超过800字）。不要泄露玩家真实身份；若记录中包含身份，应把它们视为已脱敏。"
            )

            user_prompt = (
                "以下为游戏记录的 JSON（可能已脱敏），请基于这些数据进行复盘分析，优先给出可复现的证据链和短策略总结。"
                " 输出格式要求：返回一个 JSON 对象（不要输出其他文本），其中包含 keys:"
                "\n- vote_analysis: 包含每回合票型摘要与异常票型提示。"
                "\n- speech_issues: 列表，标注可能的可疑发言和原因。"
                "\n- skill_evaluation: 列表，评估每次技能使用的收益/失误。"
                "\n- mistakes: 列表，说明可以改进的失误点。"
                "\n- strategy_recommendations: 列表，面向玩家/教练的策略要点。"
                "\n- action_items: 列表，后续可执行的具体操作（如导出时序、生成图表等）。\n"
                "现在开始分析。游戏记录（JSON）:\n" + json.dumps(record_to_use)
            )

            messages = [
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': user_prompt}
            ]

            resp = client.chat.completions.create(model=model, messages=messages)
            if resp and hasattr(resp, 'choices'):
                # 期待返回纯 JSON 文本
                txt = resp.choices[0].message.content
                ai_text = txt
                try:
                    analysis_result = json.loads(txt)
                except Exception:
                    # 若返回非严格 JSON，仍把文本保存并尝试从中抽取 JSON
                    LOGGER.warning('AI 返回内容不是严格 JSON，保存原文并转为启发式分析。')
                    analysis_result = _heuristic_analysis(game_record)
            else:
                analysis_result = _heuristic_analysis(game_record)

        except Exception as e:
            LOGGER.error(f'AI 复盘调用失败，使用启发式降级：{e}')
            analysis_result = _heuristic_analysis(game_record)
    else:
        LOGGER.info('AI 未配置或不可用，执行启发式分析')
        analysis_result = _heuristic_analysis(game_record)

    # 保存结构化 JSON 输出
    json_out = os.path.join(output_dir, f'ai_replay_{timestamp}.json')
    try:
        with open(json_out, 'w', encoding='utf-8') as f:
            json.dump(analysis_result, f, ensure_ascii=False, indent=2)
        LOGGER.info(f'分析 JSON 已保存: {json_out}')
    except Exception as e:
        LOGGER.error(f'保存分析 JSON 失败: {e}')

    # 保存可读文本报告：优先使用 AI 原文（若有），否则基于结构化结果生成文本摘要
    txt_out = os.path.join(output_dir, f'ai_replay_{timestamp}.txt')
    try:
        if ai_text:
            with open(txt_out, 'w', encoding='utf-8') as f:
                f.write(ai_text)
        else:
            # 生成简短可读报告
            lines = []
            lines.append('AI 复盘报告')
            lines.append('=' * 40)
            va = analysis_result.get('vote_analysis', {})
            lines.append('投票摘要:')
            lines.append(json.dumps(va, ensure_ascii=False))
            lines.append('\n策略建议:')
            for s in analysis_result.get('strategy_recommendations', []):
                lines.append(f'- {s}')
            lines.append('\n行动项:')
            for a in analysis_result.get('action_items', []):
                lines.append(f'- {a}')
            with open(txt_out, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
        LOGGER.info(f'分析文本已保存: {txt_out}')
    except Exception as e:
        LOGGER.error(f'保存分析文本失败: {e}')

    return {'json': json_out, 'text': txt_out}


if __name__ == '__main__':
    # 简单测试入口：读取 test_analysis/latest_record.json（若存在）并运行分析
    sample = 'test_analysis/sample_game_record.json'
    if os.path.exists(sample):
        with open(sample, 'r', encoding='utf-8') as f:
            record = json.load(f)
        analyze_game_record(record, ai_config=None)
    else:
        print('模块已安装：调用 analyze_game_record(game_record, ai_config, output_dir) 来生成复盘。')
