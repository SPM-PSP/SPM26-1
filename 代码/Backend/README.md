# 多智能体在线语音狼人杀后端

本项目是一个基于 Web 的在线狼人杀系统，当前仓库包含主游戏前端、后端、AI 复盘服务和复盘展示前端。本 README 重点说明后端运行、配置、接口和数据模型，便于部署、测试和提交验收。

## 后端技术栈

| 类型 | 技术 |
|---|---|
| 运行环境 | Node.js |
| Web 框架 | Koa 2、koa-router、koa-body |
| 数据库 | MySQL |
| ORM | Sequelize |
| 实时通信 | nodejs-websocket |
| 缓存/定时 | node-cache、node-schedule |
| 日志 | log4js |
| AI Agent 调度 | HTTP 调用独立 AI 服务 |
| 语音服务 | 火山引擎 STT/TTS 接口适配 |
| 复盘分析 | HTTP 调用 Python 复盘服务 |

## 目录结构

```text
.
├── app.js                         # 后端启动入口
├── config.json                    # 本地配置文件
├── package.json                   # Node 依赖与脚本
├── server/
│   ├── application/               # Koa 应用装载器
│   ├── controller/                # 接口控制器
│   ├── middleware/                # 鉴权、缓存等中间件
│   ├── mysqlModel/                # Sequelize 数据模型
│   ├── routes/                    # REST API 路由
│   ├── schedule/                  # 定时任务
│   └── service/                   # 业务服务
├── sql/                           # MySQL 建表和初始化脚本
├── ai_replay_service.py           # Python 复盘 HTTP 服务
├── ai_replayer.py                 # 复盘分析工具
└── replay_ai_backend/             # AI 复盘相关后端文件
```

## 启动方式

安装依赖：

```bash
npm install
```

启动后端服务：

```bash
npm run server
```

默认后端端口由 `config.json` 的 `port` 决定，当前为 `6001`。WebSocket 服务由后端启动时自动监听 `6003`，房间连接路径为：

```text
/lrs/{roomId}
```

主前端开发启动：

```bash
npm run front
```

前后端同时启动：

```bash
npm run dev
```

生产构建主前端：

```bash
npm run build
```

## 配置说明

后端配置主要来自 `config.json`，部分外部服务也支持环境变量覆盖。

| 配置项 | 说明 |
|---|---|
| `port` | Koa HTTP 服务端口 |
| `mysql.local` | 本地 MySQL 数据库配置 |
| `jwt.secret` | JWT 签名密钥 |
| `crypto.secret` | 密码加密相关密钥 |
| `aiService.baseUrl` | AI Agent 服务地址 |
| `aiReplayService.baseUrl` | Python 复盘服务地址 |
| `aiReplayModel` | 复盘大模型配置 |
| `voiceService` | 火山引擎 STT/TTS 配置 |

可用环境变量包括：

| 环境变量 | 说明 |
|---|---|
| `DB_ENV` | 数据库环境，可配合 `mysql.dev` 使用 |
| `AI_SERVICE_BASE_URL` | 覆盖 AI Agent 服务地址 |
| `AI_REPLAY_SERVICE_BASE_URL` | 覆盖复盘服务地址 |
| `OPENAI_API_KEY` | 复盘大模型 API Key |
| `OPENAI_MODEL` | 复盘大模型名称 |
| `OPENAI_BASE_URL` | 复盘大模型 Base URL |
| `VOLCENGINE_API_KEY` | 火山引擎语音服务 API Key |
| `VOLCENGINE_UID` | 语音服务用户标识 |
| `VOLCENGINE_STT_URL` | STT 接口地址 |
| `VOLCENGINE_TTS_URL` | TTS 接口地址 |
| `VOICE_SERVICE_TIMEOUT` | 语音服务超时时间 |

> 上传或公开提交前，不要提交真实数据库密码、JWT 密钥、AI Key、语音 Key。建议提交脱敏后的 `config.example.json`，本地运行时再复制为 `config.json`。

## 数据库初始化

后端使用 MySQL 和 Sequelize。初始化数据库时，可参考 `sql/` 目录中的脚本：

```text
sql/mysql_schema.sql
sql/mysql_seed.sql
sql/mysql_alter_6_12.sql
```

建议流程：

1. 创建数据库，例如 `werewolf`。
2. 执行 `sql/mysql_schema.sql` 建表。
3. 执行 `sql/mysql_seed.sql` 初始化基础账号、角色和权限数据。
4. 如需支持 6 至 12 人扩展座位，执行 `sql/mysql_alter_6_12.sql`。
5. 修改 `config.json` 中的 `mysql.local` 配置。

## 核心接口

路由统一定义在 `server/routes/index.js`。

| 模块 | 主要接口 |
|---|---|
| 认证 | `POST /api/login`、`POST /api/register` |
| 用户 | `GET /api/user/getUserInfo/auth`、`POST /api/user/create/auth` |
| 房间 | `GET /api/room/create/auth`、`GET /api/room/info/auth`、`GET /api/room/join/auth`、`GET /api/room/quit/auth`、`GET /api/room/modifyName/auth`、`GET /api/room/kick/auth`、`GET /api/room/seat/auth` |
| 游戏 | `POST /api/game/start/auth`、`GET /api/game/info/auth`、`GET /api/game/nextStage/auth`、`GET /api/game/result/auth`、`GET /api/game/destroy/auth`、`GET /api/game/again/auth`、`GET /api/game/ob/auth` |
| 角色技能 | `GET /api/game/checkPlayer/auth`、`GET /api/game/assaultPlayer/auth`、`GET /api/game/antidotePlayer/auth`、`GET /api/game/poisonPlayer/auth`、`GET /api/game/shootPlayer/auth`、`GET /api/game/boomPlayer/auth` |
| 投票 | `GET /api/game/votePlayer/auth` |
| 遗言 | `POST /api/game/saveLastWords/auth` |
| 语音 | `POST /api/voice/stt/auth`、`POST /api/voice/tts/auth`、`POST /api/voice/speech/auth` |
| 复盘 | `POST /api/game/replay/auth`、`GET /api/game/replay/health/auth`、`GET /api/game/replay/file` |

带 `/auth` 后缀的接口需要鉴权 token。

## 游戏流程

后端通过 `game.stage` 表示当前游戏阶段：

| 阶段值 | 含义 |
|---:|---|
| `0` | 夜晚幕布/准备进入夜晚 |
| `1` | 预言家行动 |
| `2` | 狼人行动 |
| `3` | 女巫行动 |
| `4` | 天亮结算 |
| `5` | 白天发言 |
| `6` | 投票 |
| `6.5` | 平票 PK |
| `7` | 放逐结果与遗言 |

阶段推进主要由 `server/service/gameService.js` 和 `server/service/stageService.js` 完成。技能、投票、死亡、发言顺序、遗言顺序和胜负判定会写入 `action`、`record`、`gameTag` 等数据表。

## AI Agent

AI Agent 由 `server/service/aiService.js` 适配，默认通过 HTTP 调用独立服务。

主要能力包括：

* 开局时自动补齐 AI 席位；
* 向 AI 服务 bootstrap 游戏；
* 同步 AI 玩家角色；
* 按阶段触发 AI 发言、投票和夜间行动；
* 广播公共事件给 AI 记忆；
* 全 AI 狼人场景下调用夜间共识；
* 真人狼人存在时保存 AI 狼人建议。

AI 服务不可用时，后端会返回失败结果或记录错误日志；真实推理质量需要启动 AI 服务后联调验证。

## 语音 STT/TTS

语音功能由 `server/service/voiceService.js` 和 `server/controller/voiceController.js` 实现。

| 接口 | 说明 |
|---|---|
| `/api/voice/stt/auth` | 上传音频并转写文本，支持 multipart 文件或 `audioBase64` |
| `/api/voice/tts/auth` | 文本转 MP3 音频，返回 `audio/mpeg` |
| `/api/voice/speech/auth` | 玩家发言提交，校验游戏阶段、存活状态和当前发言轮次 |

语音服务依赖火山引擎配置。未配置 `VOLCENGINE_API_KEY` 或 `voiceService.apiKey` 时，接口会返回语音服务未配置相关错误。

## AI 复盘

复盘链路由 `server/service/replayService.js` 实现：

1. 检查游戏是否已结束；
2. 汇总玩家最终状态、游戏记录、行动记录、投票统计和回合记录；
3. 生成结构化 `game_record`；
4. 调用 Python 复盘服务 `/analyze`；
5. 返回分析文件和复盘数据。

复盘服务健康检查接口为：

```text
GET /api/game/replay/health/auth
```

读取复盘文件时，后端只允许访问 `replay_analysis` 目录下的文件，避免任意路径读取。

## 主要数据模型

模型文件位于 `server/mysqlModel/`。

| 模型 | 说明 |
|---|---|
| `user` | 用户账号、昵称、角色等基础信息 |
| `room` | 房间状态、房主、座位、等待区、观战用户 |
| `game` | 游戏状态、当前阶段、天数、人数、配置和胜利阵营 |
| `player` | 每局游戏中的玩家身份、阵营、状态、技能和座位 |
| `vision` | 玩家之间的视野关系 |
| `action` | 玩家技能、投票等关键操作 |
| `record` | 游戏过程记录、发言、投票结果、系统提示 |
| `gameTag` | 死亡、发言顺序、PK、投票出局等关键事件标签 |
| `role` | 系统角色 |
| `route` | 后台路由权限 |
| `uiPermission` | UI 权限 |
| `urlPermission` | URL 权限 |

## 静态检查

后端 JS 语法检查：

```powershell
Get-ChildItem server -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

复盘 Python 脚本语法检查：

```powershell
python -m py_compile ai_replay_service.py ai_replayer.py replay_ai_backend/ai_replayer.py
```

## 上传前检查清单

上传后端前建议确认：

* `README.md` 与当前技术栈一致；
* `server/**/*.js` 静态语法检查通过；
* `ai_replay_service.py`、`ai_replayer.py` 编译检查通过；
* `config.json` 已脱敏，真实密钥未上传；
* MySQL 建表脚本和初始化脚本随代码一并提交；
* AI、语音、复盘等外部服务地址在说明中写清；
* `node_modules/`、日志、缓存、复盘输出文件不作为源码上传。
