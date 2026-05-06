**AI 复盘模块 — 接口文档**

路径：`utils/ai_replayer.py`

目的：为后端或其它服务方提供一个清晰、安全、可复现的调用接口，用于基于游戏日志（`game_record`）生成复盘分析报告（结构化 JSON + 可读文本）。

一、快速概览
- 主函数：`analyze_game_record(game_record: Dict[str, Any], ai_config: Optional[Dict]=None, output_dir: str='test_analysis', desensitize: bool=True) -> Dict[str, str]`
- 行为：优先使用 AI（若配置并可用）生成严格 JSON 分析；若无 AI 或调用失败，退化为启发式分析；始终保存 `json` 与 `text` 两个输出文件，并返回两者路径。

二、环境与依赖
- Python 3.8+
- 可选依赖：`openai` 包（用于启用 AI 复盘）。模块在找不到 `openai` 时会降级为启发式分析。
- 输出目录：默认 `test_analysis`，会自动创建。

三、输入说明
- 参数 `game_record`（必选）—— 完整的结构化游戏记录（Python dict），典型字段包括：
  - `start_time`, `round_records`（每回合讨论/投票记录）, `events`（结构化事件流）, `game_stats`（总轮数/死亡/技能使用等）, `final_result`（胜方、最终状态）等。
  - 要求：输入数据应为完整 json-serializable 结构。

- 参数 `ai_config`（可选）—— AI 配置字典，示例：
  {
    "api_key": "sk-...",
    "model": "gpt-4",
    "baseurl": "https://your-api-endpoint.com/v1"  # 可选
  }

- 参数 `output_dir`（可选）—— 输出文件目录（字符串），默认 `test_analysis`。
- 参数 `desensitize`（可选）—— 是否在发送给 AI 前脱敏（默认 True）。脱敏策略：将玩家 `role` 与 `ai_model` 等敏感字段替换为 `REDACTED`。

四、输出说明
- 返回值：Python dict：
  - `{"json": <json_file_path>, "text": <text_file_path>}`

- 生成文件：
  - `<output_dir>/ai_replay_<timestamp>.json` — 结构化分析结果（JSON）。
  - `<output_dir>/ai_replay_<timestamp>.txt` — 可读文本报告（AI 原文或自动汇总）。

- 结构化 JSON 规范（期望字段，若 AI 返回严格 JSON，应包含）：
  - `vote_analysis`: object — 每回合票型摘要，异常票型提示，top 被点玩家统计；
  - `speech_issues`: list — 可疑发言项，每条包含 `{player_id?, round?, excerpt, reason}`（若脱敏则不包含真实 role）；
  - `skill_evaluation`: object/list — 每次关键技能使用的收益/失误评估；
  - `mistakes`: list — 在策略或执行层面的失误总结；
  - `strategy_recommendations`: list — 给玩家/教练的策略要点（可直接呈现）；
  - `action_items`: list — 可执行的后续任务（导出时序、画图、复核发言等）。

注：如果 AI 未返回严格 JSON，模块会保存 AI 原文到 `.txt` 并用启发式分析生成 `.json`。

五、错误与降级行为
- 若 `openai` 未安装或 `ai_config` 未提供 `api_key`：模块不抛异常，只记录日志并使用启发式分析。
- 若 AI 调用失败（超时、网络或返回格式不符）：模块回退为启发式分析并保存 AI 返回原文（若有）。
- 保存失败会记录错误日志，但函数仍尽量返回路径（可能为部分成功）。

六、示例用法（Python）
```py
from utils.ai_replayer import analyze_game_record

# game_record 为运行时从 GameLogger 中获得的记录（dict）
game_record = load_some_game_record()
ai_cfg = {"api_key": "sk-xxx", "model": "gpt-4"}  # 可选
out = analyze_game_record(game_record, ai_config=ai_cfg, output_dir='test_analysis', desensitize=True)
print('生成文件：', out)
```

七、集成建议（后端调用场景）
- 同步调用：直接 import 并调用 `analyze_game_record(...)`。
- 异步/任务队列：建议后端将 `game_record` 写入持久存储（如 S3 或 DB），并把路径/ID 放入后台任务队列（Celery/RQ），由工作者加载并调用 `analyze_game_record` 以避免主流程阻塞。
- 安全性：若后端希望 AI 能看到完整身份信息，请在 `desensitize=False` 下调用，但需确保合规与隐私要求。

八、HTTP 服务示意（可选）
- 若需要将复盘作为服务暴露（REST），后端可实现一个简单 POST 接口：
  POST /api/v1/replay
  body: {"game_record": {...}, "ai_config": {...}, "desensitize": true}
  response: {"job_id": "..."}（若异步）或 {"json": "path", "text": "path"}（若同步）

九、注意事项与扩展点
- Prompt 与输出模版：目前模块使用通用 prompt，后端可根据需求定制更严格的 schema 与证据引用格式（例如每个结论必须引用具体 `round`/`event`）。
- 图表支持：模块目前保存 JSON 与文本；若需图表（票型时序、发言热力图），可扩展为同时导出 CSV/PNG。

十、联系与维护
- 模块文件：`utils/ai_replayer.py`。如需改进输出 schema 或加入新字段，请在该文件中调整 prompt 与解析逻辑，并同步更新此文档。

—— 结束 ——