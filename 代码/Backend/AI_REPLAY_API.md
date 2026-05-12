# AI 复盘接口文档

本文档说明当前项目中与“AI 复盘”相关的接口，分为两层：

1. Python 复盘服务接口
路径文件: [ai_replay_service.py](./ai_replay_service.py)

2. 主游戏后端对外接口
路径文件:
- [server/controller/gameController.js](./server/controller/gameController.js)
- [server/service/replayService.js](./server/service/replayService.js)
- [server/routes/index.js](./server/routes/index.js)

## 1. 架构关系

当前调用链路如下：

`前端 / 其他服务 -> Backend(JS) -> replayService.js -> HTTP -> ai_replay_service.py -> utils/ai_replayer.py`

说明：
- `Backend` 主后端是 Node.js/JS。
- `ai_replay_service.py` 是独立的 Python HTTP 服务。
- JS 与 Python 不是直接互相 import，而是通过 HTTP 调用连接。

---

## 2. Python 复盘服务接口

默认服务地址：

```text
http://127.0.0.1:8002
```

默认端口可通过环境变量修改：

```text
AI_REPLAY_PORT
```

### 2.1 健康检查

- 路径: `/health`
- 方法: `GET`
- 是否鉴权: 否

#### 请求示例

```bash
curl -X GET "http://127.0.0.1:8002/health"
```

#### 成功返回

```json
{
  "status": "ok",
  "service": "ai_replay_service",
  "utils_dir": "F:/SPM26-1/代码/utils",
  "timestamp": "2026-05-11T12:00:00.000000"
}
```

---

### 2.2 同步复盘分析

- 路径: `/analyze`
- 方法: `POST`
- 是否鉴权: 否
- Content-Type: `application/json`

#### 请求体

```json
{
  "game_record": {
    "game_id": "6800xxxx",
    "room_id": "67ffxxxx",
    "start_time": "2026-05-11T10:00:00.000Z",
    "end_time": "2026-05-11T10:30:00.000Z",
    "player_count": 9,
    "mode": "standard_9",
    "winner": 1,
    "days": 3,
    "events": [],
    "game_stats": {
      "total_actions": 25,
      "votes": 9,
      "ability_uses": 6,
      "total_deaths": 4
    },
    "round_records": [],
    "final_result": {
      "winner": "好人阵营",
      "final_state": {
        "players": {}
      }
    }
  },
  "ai_config": {
    "api_key": "sk-xxxxx",
    "model": "gpt-4",
    "baseurl": null
  },
  "output_dir": "replay_analysis",
  "desensitize": true
}
```

#### 字段说明

- `game_record`: 必填，对局结构化记录，必须是 JSON 对象。
- `ai_config`: 可选，AI 调用配置。
- `ai_config.api_key`: 可选，大模型 API Key。
- `ai_config.model`: 可选，默认 `gpt-4`。
- `ai_config.baseurl`: 可选，自定义模型服务地址。
- `ai_config.api_key_env`: 可选，如果传这个字段，服务会从对应环境变量中读取 key。
- `output_dir`: 可选，分析结果输出目录。
- `desensitize`: 可选，是否脱敏，默认 `true`。

#### 成功返回

```json
{
  "success": true,
  "result": {
    "json": "F:/SPM26-1/代码/Backend/replay_analysis/ai_replay_20260511_120000.json",
    "text": "F:/SPM26-1/代码/Backend/replay_analysis/ai_replay_20260511_120000.txt"
  },
  "timestamp": "2026-05-11T12:00:00.000000"
}
```

#### 失败返回

参数错误：

```json
{
  "error": "missing required field: game_record"
}
```

或：

```json
{
  "error": "game_record must be a JSON object"
}
```

服务异常：

```json
{
  "error": "analysis failed: <具体错误>"
}
```

#### curl 测试

最小可运行测试：

```bash
curl -X POST "http://127.0.0.1:8002/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "game_record": {
      "game_id": "test_game_001",
      "room_id": "test_room_001",
      "start_time": "2026-05-11T10:00:00.000Z",
      "end_time": "2026-05-11T10:30:00.000Z",
      "player_count": 9,
      "mode": "standard_9",
      "winner": 1,
      "days": 1,
      "events": [],
      "game_stats": {
        "total_actions": 0,
        "votes": 0,
        "ability_uses": 0,
        "total_deaths": 0
      },
      "round_records": [],
      "final_result": {
        "winner": "好人阵营",
        "final_state": {
          "players": {}
        }
      }
    },
    "desensitize": true
  }'
```

带 AI 配置测试：

```bash
curl -X POST "http://127.0.0.1:8002/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "game_record": {
      "game_id": "test_game_002",
      "room_id": "test_room_002",
      "start_time": "2026-05-11T10:00:00.000Z",
      "end_time": "2026-05-11T10:30:00.000Z",
      "player_count": 9,
      "mode": "standard_9",
      "winner": 0,
      "days": 1,
      "events": [],
      "game_stats": {
        "total_actions": 0,
        "votes": 0,
        "ability_uses": 0,
        "total_deaths": 0
      },
      "round_records": [],
      "final_result": {
        "winner": "狼人阵营",
        "final_state": {
          "players": {}
        }
      }
    },
    "ai_config": {
      "api_key": "sk-xxxxx",
      "model": "gpt-4"
    },
    "output_dir": "replay_analysis",
    "desensitize": true
  }'
```

---

### 2.3 异步复盘分析占位接口

- 路径: `/analyze_async`
- 方法: `POST`
- 是否鉴权: 否

说明：
- 当前实现与 `/analyze` 行为相同。
- 目前只是预留接口，尚未实现真正的任务队列异步化。

#### curl 测试

```bash
curl -X POST "http://127.0.0.1:8002/analyze_async" \
  -H "Content-Type: application/json" \
  -d '{
    "game_record": {
      "game_id": "test_game_async",
      "room_id": "test_room_async",
      "start_time": "2026-05-11T10:00:00.000Z",
      "end_time": "2026-05-11T10:30:00.000Z",
      "player_count": 9,
      "mode": "standard_9",
      "winner": 1,
      "days": 1,
      "events": [],
      "game_stats": {
        "total_actions": 0,
        "votes": 0,
        "ability_uses": 0,
        "total_deaths": 0
      },
      "round_records": [],
      "final_result": {
        "winner": "好人阵营",
        "final_state": {
          "players": {}
        }
      }
    }
  }'
```

---

## 3. 主游戏后端对外接口

这部分接口由 Node.js 主后端对前端提供。

基础说明：
- 带 `/auth` 的接口需要鉴权。
- 鉴权方式：HTTP Header 中传 `Authorization: <token>`。
- token 来源：登录接口 `/api/login` 成功返回的 `accessToken`。

### 3.1 登录获取 token

- 路径: `/api/login`
- 方法: `POST`
- 是否鉴权: 否

#### 请求体

```json
{
  "username": "your_username",
  "password": "your_password"
}
```

#### 成功返回

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt_token_here",
    "user": {
      "username": "your_username"
    }
  },
  "errorCode": null,
  "errorMessage": null
}
```

#### curl 测试

```bash
curl -X POST "http://127.0.0.1:3000/api/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

---

### 3.2 游戏复盘分析

- 路径: `/api/game/replay/auth`
- 方法: `POST`
- 是否鉴权: 是
- Header: `Authorization: <accessToken>`

#### 请求体

```json
{
  "gameId": "6800xxxx",
  "enableAI": true,
  "aiModel": "gpt-4",
  "outputDir": "replay_analysis",
  "desensitize": true
}
```

#### 字段说明

- `gameId`: 必填，已结束游戏的 ID。
- `enableAI`: 可选，是否启用大模型分析。
- `aiModel`: 可选，模型名，默认 `gpt-4`。
- `outputDir`: 可选，输出目录。
- `desensitize`: 可选，是否脱敏，默认 `true`。

#### 成功返回

```json
{
  "success": true,
  "data": {
    "gameId": "6800xxxx",
    "analysisFiles": {
      "json": "F:/SPM26-1/代码/Backend/replay_analysis/ai_replay_20260511_120000.json",
      "text": "F:/SPM26-1/代码/Backend/replay_analysis/ai_replay_20260511_120000.txt"
    },
    "gameRecord": {
      "game_id": "6800xxxx"
    },
    "timestamp": "2026-05-11T12:00:00.000000"
  },
  "errorCode": null,
  "errorMessage": null
}
```

#### 失败返回

```json
{
  "success": false,
  "data": null,
  "errorCode": -1,
  "errorMessage": "游戏尚未结束，无法进行复盘分析！"
}
```

#### curl 测试

```bash
curl -X POST "http://127.0.0.1:3000/api/game/replay/auth" \
  -H "Content-Type: application/json" \
  -H "Authorization: YOUR_ACCESS_TOKEN" \
  -d '{
    "gameId": "6800xxxx",
    "enableAI": true,
    "aiModel": "gpt-4",
    "outputDir": "replay_analysis",
    "desensitize": true
  }'
```

---

### 3.3 复盘服务健康检查

- 路径: `/api/game/replay/health/auth`
- 方法: `GET`
- 是否鉴权: 是
- Header: `Authorization: <accessToken>`

#### 成功返回

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "ai_replay_service",
    "utils_dir": "F:/SPM26-1/代码/utils",
    "timestamp": "2026-05-11T12:00:00.000000"
  },
  "errorCode": null,
  "errorMessage": null
}
```

#### curl 测试

```bash
curl -X GET "http://127.0.0.1:3000/api/game/replay/health/auth" \
  -H "Authorization: YOUR_ACCESS_TOKEN"
```

---

### 3.4 读取复盘文件内容

- 路径: `/api/game/replay/file`
- 方法: `GET`
- 是否鉴权: 否

#### Query 参数

- `file`: 必填，文件完整路径。

#### 示例

```text
/api/game/replay/file?file=F:/SPM26-1/代码/Backend/replay_analysis/ai_replay_20260511_120000.json
```

#### 返回

- 若文件是 `.json`，返回原始 JSON 文本。
- 若文件是 `.txt`，返回原始文本内容。
- 若路径不安全或文件不存在，返回错误对象。

#### curl 测试

Windows 下建议使用双引号：

```bash
curl -X GET "http://127.0.0.1:3000/api/game/replay/file?file=F:/SPM26-1/代码/Backend/replay_analysis/ai_replay_20260511_120000.json"
```

---

## 4. 启动与联调建议

### 4.1 启动 Python 复盘服务

```bash
cd F:\SPM26-1\代码\Backend
python ai_replay_service.py
```

默认启动后：

- 健康检查: `http://127.0.0.1:8002/health`
- 分析接口: `http://127.0.0.1:8002/analyze`

### 4.2 启动主后端

按你们原有 Node.js 后端方式启动。

### 4.3 环境变量

可选环境变量：

```text
AI_REPLAY_PORT=8002
AI_REPLAY_DEBUG=false
AI_REPLAY_SERVICE_BASE_URL=http://127.0.0.1:8002
AUTO_TRIGGER_REPLAY_ANALYSIS=true
REPLAY_ENABLE_AI=true
REPLAY_AI_MODEL=gpt-4
REPLAY_OUTPUT_DIR=replay_analysis
REPLAY_DESENSITIZE=true
OPENAI_API_KEY=your_key
```

---

## 5. 当前实际负责复盘的接口清单

### Python 服务

- `GET /health`
- `POST /analyze`
- `POST /analyze_async`

### 主后端对外

- `POST /api/game/replay/auth`
- `GET /api/game/replay/health/auth`
- `GET /api/game/replay/file`

---

## 6. 备注

- 当前 `/analyze_async` 只是占位，尚未接入真正异步任务队列。
- 主后端的 `/api/game/replay/auth` 要求游戏状态已结束。
- 如果配置了自动复盘，游戏结束时主后端会异步触发一次复盘分析。
