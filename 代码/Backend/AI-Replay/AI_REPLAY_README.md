# AI 复盘模块说明

本文档用于说明狼人杀项目中的 AI 复盘模块，适合答辩讲解、开发维护和现场排查问题。

## 1. 模块定位

AI 复盘模块负责在一局狼人杀结束后，把数据库中的游戏事实整理成结构化对局记录，再调用本地 Python AI 服务生成复盘报告。

它不是游戏主流程的一部分，而是游戏结束后的分析能力。即使 AI 复盘服务超时或不可用，也不会影响房间创建、角色分配、阶段推进、投票结算等核心游戏逻辑。

## 2. 核心文件

| 文件 | 作用 |
| --- | --- |
| `server/service/replayService.js` | Node 后端复盘服务，负责收集游戏数据、调用 AI 复盘服务、写入复盘索引 |
| `server/controller/gameController.js` | 提供复盘相关接口，例如生成复盘、查询复盘详情、健康检查 |
| `ai_replay_service.py` | Python Flask 服务，提供 `/health` 和 `/analyze` 接口 |
| `ai_replayer.py` | AI 复盘核心逻辑，负责整理 prompt、调用大模型、生成 JSON/TXT 报告 |
| `replay_analysis/` | 复盘输出目录，保存 AI 分析文件和 `replay_index.json` |
| `config.json` | 配置 AI 复盘服务地址、超时时间和模型参数 |

## 3. 整体流程

一局游戏结束后，后端会把 `lcoco_game.status` 设置为 `2`，表示游戏结束。之后复盘流程如下：

1. `gameController` 接收到复盘请求，或游戏结束后自动触发复盘。
2. `replayService.generateGameRecord()` 从数据库读取本局游戏数据。
3. 后端整理出结构化 `game_record`。
4. `replayService.analyzeGame()` 调用 Python 服务的 `/analyze` 接口。
5. `ai_replay_service.py` 调用 `ai_replayer.analyze_game_record()`。
6. `ai_replayer.py` 生成 AI 复盘 JSON 和 TXT 文件。
7. `replayService` 把生成结果写入 `replay_analysis/replay_index.json`。
8. 前端复盘页面根据 `gameId` 查询复盘详情并展示。

可以用一句话概括：

> Node 后端负责收集真实游戏数据，Python 服务负责 AI 分析，复盘文件通过 `gameId` 建立索引供前端查询。

## 4. 数据来源

AI 复盘不是直接读取前端页面，而是从数据库读取真实对局数据。

主要数据表包括：

| 表名 | 作用 |
| --- | --- |
| `lcoco_game` | 当前局状态、阶段、天数、胜负、人数配置 |
| `lcoco_room` | 房间信息，以及当前展示的 `gameId` |
| `lcoco_player` | 玩家身份、阵营、座位、生死状态、出局原因 |
| `lcoco_action` | 技能动作和投票动作 |
| `lcoco_record` | 公共日志、发言、遗言、系统提示 |
| `lcoco_gameTag` | 阶段中间结果，例如死亡信息、发言顺序、投票统计 |

复盘输入中的关键字段包括：

| 字段 | 含义 |
| --- | --- |
| `game_id` | 游戏 ID |
| `room_id` | 房间 ID |
| `player_count` | 玩家数量 |
| `mode` | 游戏板子，例如 `standard_6` |
| `winner` / `winner_label` | 胜利阵营 |
| `days` | 游戏持续天数 |
| `final_result.final_state.players` | 玩家最终状态 |
| `events` | 游戏事件和公共记录 |
| `vote_records` | 投票记录 |
| `player_logs` | 每个玩家的发言、行动、投票情况 |
| `round_records` | 按天整理的阶段记录 |
| `game_stats` | 动作数、投票数、技能使用数、死亡数 |

## 5. 输出结果

AI 复盘会输出两类文件：

| 文件 | 用途 |
| --- | --- |
| `ai_replay_YYYYMMDD_HHMMSS.json` | 结构化分析结果，便于前端展示 |
| `ai_replay_YYYYMMDD_HHMMSS.txt` | 文本版复盘报告，便于直接阅读 |

同时，`replay_analysis/replay_index.json` 会维护复盘索引。索引中会记录：

- `gameId`
- `roomId`
- `winnerLabel`
- `players`
- `analysisFiles.json`
- `analysisFiles.text`
- `timestamp`

前端查询复盘详情时，不需要扫描所有文件，只需要根据 `gameId` 在索引里找到对应文件。

## 6. 后端接口

### 6.1 健康检查

```http
GET /api/game/replay/health/auth
```

Node 后端会请求 Python 服务：

```http
GET http://127.0.0.1:8002/health
```

用于判断 AI 复盘服务是否启动。

### 6.2 生成复盘

```http
POST /api/game/replay/auth
```

常见请求体：

```json
{
  "gameId": 456,
  "enableAI": true,
  "outputDir": "replay_analysis",
  "desensitize": true,
  "force": false
}
```

说明：

- `gameId`：要复盘的游戏 ID。
- `enableAI`：是否启用大模型分析。
- `outputDir`：复盘文件输出目录。
- `desensitize`：是否对输入进行脱敏处理。
- `force`：是否强制重新生成，默认会复用已有复盘文件。

### 6.3 查询复盘详情

```http
GET /api/game/replay/detail/auth?gameId=456
```

如果 `replay_index.json` 中已经有对应复盘文件，则直接读取。如果索引不存在，后端会尝试按需生成复盘。

### 6.4 读取复盘文件

```http
GET /api/game/replay/file?file=replay_analysis/ai_replay_20260601_220306.txt
```

该接口只允许读取 `replay_analysis` 目录下的文件，避免任意文件读取风险。

## 7. Python 服务接口

### 7.1 `/health`

用于检查服务是否正常运行。

返回示例：

```json
{
  "status": "ok",
  "service": "ai_replay_service",
  "timestamp": "2026-06-03T10:00:00"
}
```

### 7.2 `/analyze`

用于执行复盘分析。

请求示例：

```json
{
  "game_record": {
    "game_id": 456,
    "room_id": 47,
    "winner_label": "好人阵营"
  },
  "ai_config": {
    "api_key": "xxx",
    "baseurl": "https://open.bigmodel.cn/api/paas/v4/",
    "model": "glm-4.5-air",
    "timeout": 90
  },
  "output_dir": "replay_analysis",
  "desensitize": true
}
```

返回示例：

```json
{
  "success": true,
  "result": {
    "json": "replay_analysis/ai_replay_20260601_220306.json",
    "text": "replay_analysis/ai_replay_20260601_220306.txt"
  },
  "timestamp": "2026-06-01T22:07:22.054Z"
}
```

## 8. 配置说明

`config.json` 中与复盘有关的配置：

```json
{
  "aiReplayService": {
    "baseUrl": "http://127.0.0.1:8002",
    "timeout": 180000
  },
  "aiReplayModel": {
    "apiKey": "your-api-key",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4/",
    "model": "glm-4.5-air",
    "timeout": 90
  }
}
```

说明：

- `aiReplayService.baseUrl` 是 Python 复盘服务地址。
- `aiReplayService.timeout` 是 Node 后端等待 Python 服务返回的超时时间。
- `aiReplayModel` 是大模型配置，会传给 Python 服务。
- 如果没有可用模型配置，复盘逻辑仍可使用启发式 fallback 生成基础报告。

## 9. 启动方式

### 9.1 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 9.2 启动 AI 复盘服务

```bash
python ai_replay_service.py
```

默认监听端口为 `8002`。

### 9.3 启动游戏后端

```bash
npm run server
```

### 9.4 启动前端

```bash
npm start
```

### 9.5 使用复盘

游戏结束后，前端会显示“复盘”入口。点击后会打开复盘页面，按 `gameId` 查询对应的 AI 复盘结果。

## 10. 缓存与复用机制

`replayService.analyzeGame()` 会先检查 `replay_index.json`：

- 如果当前 `gameId` 已经有复盘文件，并且文件真实存在，则直接复用。
- 如果没有复盘文件，才会重新生成。
- 如果生成过程中接口超时，但文件已经落盘，后端会尝试通过最近生成的文件恢复索引。

这样可以避免同一局游戏重复调用大模型，减少等待时间和接口成本。

## 11. 异常处理

常见异常及处理方式：

| 问题 | 原因 | 处理 |
| --- | --- | --- |
| 健康检查失败 | Python 服务没启动或端口不对 | 启动 `ai_replay_service.py`，确认端口 8002 |
| 复盘超时 | 大模型响应慢或输入较大 | 增大 `aiReplayService.timeout`，或稍后重试 |
| `replay_index.json` 找不到记录 | 复盘文件未生成或索引丢失 | 重新生成复盘，或使用恢复逻辑 |
| 前端看不到复盘按钮 | 当前 `game.status` 不是 `2` | 确认该局游戏是否已结束 |
| 复盘内容不完整 | 原始游戏日志不足 | 检查 `lcoco_record`、`lcoco_action` 是否有完整记录 |

## 12. 当前示例

房间 `012411` 对应的房间 ID 是 `47`。最近一次可复盘的完整结束局是：

| 字段 | 值 |
| --- | --- |
| `gameId` | `456` |
| `roomId` | `47` |
| `status` | `2`，已结束 |
| `winner` | `1`，好人阵营 |
| 复盘 JSON | `replay_analysis/ai_replay_20260601_220306.json` |
| 复盘 TXT | `replay_analysis/ai_replay_20260601_220306.txt` |
