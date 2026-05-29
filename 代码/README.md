# 多智能体在线语音狼人杀系统

本项目是一个基于 Web 的多智能体在线语音狼人杀系统，支持用户登录、房间管理、多人对局、角色技能结算、投票放逐、AI 玩家参与、语音 STT/TTS 交互和赛后 AI 复盘。仓库中包含主游戏前端、Node.js 后端、复盘展示前端、Python 复盘服务及 AI 相关模块。

本文档作为项目总 README，用于说明整体结构、公共环境准备、各模块运行方式和提交前注意事项。后端部分已补充完整；前端、AI Agent 等模块可由对应同学在预留小节继续补充。

## 项目结构

```text
.
├── app.js                         # Node.js 后端启动入口
├── package.json                   # 主游戏前端 + 后端依赖与脚本
├── config.json                    # 本地配置文件，上传前需脱敏
├── client/                        # 主游戏前端 React 代码
├── server/                        # Koa 后端代码
│   ├── application/               # Koa 应用装载器
│   ├── controller/                # 接口控制器
│   ├── middleware/                # 鉴权、缓存等中间件
│   ├── mysqlModel/                # Sequelize 数据模型
│   ├── routes/                    # REST API 路由
│   ├── schedule/                  # 定时任务
│   └── service/                   # 业务服务
├── sql/                           # MySQL 建表和初始化脚本
├── replay_frontend/               # 复盘展示前端 Vue/Vite 代码
├── ai_replay_service.py           # Python 复盘 HTTP 服务
├── ai_replayer.py                 # 复盘分析工具
├── replay_ai_backend/             # AI 复盘相关代码和接口说明
├── public/                        # 主前端构建产物/静态资源
├── preview/                       # 项目预览图
└── logs/                          # 本地运行日志，上传时不建议包含
```

## 公共环境

| 环境 | 用途 |
|---|---|
| Node.js / npm | 运行主前端、后端和复盘前端 |
| MySQL | 后端数据持久化 |
| Python 3 | 运行复盘服务和复盘脚本 |
| 浏览器 | 访问主游戏前端和复盘展示页面 |
| AI/语音服务凭证 | AI Agent、AI 复盘、STT/TTS 联调时使用 |

## 一键安装依赖

项目根目录安装主前端和后端依赖：

```bash
npm install
```

复盘前端依赖：

```bash
cd replay_frontend
npm install
```

Python 复盘服务依赖：

```bash
pip install -r requirements.txt
```

## 模块运行方式总览

| 模块 | 目录 | 安装依赖 | 启动命令 | 默认地址/端口 | 负责人补充 |
|---|---|---|---|---|---|
| 主游戏前端 | `client/` | 根目录 `npm install` | `npm run front` | CRA 开发服务端口，按终端输出为准 | 前端同学补充 |
| Node.js 后端 | `server/` | 根目录 `npm install` | `npm run server` | HTTP `6001`，WebSocket `6003` | 已补充 |
| 前后端同时启动 | 根目录 | 根目录 `npm install` | `npm run dev` | 前端端口按终端输出，后端 `6001` | 可选 |
| 复盘展示前端 | `replay_frontend/` | `cd replay_frontend && npm install` | `npm run dev` | Vite 默认端口，按终端输出为准 | 前端同学补充 |
| Python 复盘服务 | 根目录 | `pip install -r requirements.txt` | `python ai_replay_service.py` | 默认 `8002` | AI/复盘同学补充 |
| AI Agent 服务 | AI 模块目录 | AI 同学补充 | AI 同学补充 | 后端默认调用 `AI_SERVICE_BASE_URL` | AI 同学补充 |

## 后端说明

### 后端技术栈

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

### 后端启动

在项目根目录执行：

```bash
npm run server
```

默认后端 HTTP 端口由 `config.json` 的 `port` 决定，当前为 `6001`。WebSocket 服务由后端启动时自动监听 `6003`，房间连接路径为：

```text
/lrs/{roomId}
```

### 后端配置

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

上传或公开提交前，不要提交真实数据库密码、JWT 密钥、AI Key、语音 Key。建议提交脱敏后的 `config.example.json`，本地运行时再复制为 `config.json`。

### 数据库初始化

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

### 核心接口

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

### 游戏阶段

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

### AI Agent 接入

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

### 语音 STT/TTS

语音功能由 `server/service/voiceService.js` 和 `server/controller/voiceController.js` 实现。

| 接口 | 说明 |
|---|---|
| `/api/voice/stt/auth` | 上传音频并转写文本，支持 multipart 文件或 `audioBase64` |
| `/api/voice/tts/auth` | 文本转 MP3 音频，返回 `audio/mpeg` |
| `/api/voice/speech/auth` | 玩家发言提交，校验游戏阶段、存活状态和当前发言轮次 |

语音服务依赖火山引擎配置。未配置 `VOLCENGINE_API_KEY` 或 `voiceService.apiKey` 时，接口会返回语音服务未配置相关错误。

### AI 复盘

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

### 主要数据模型

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

## 前端模块说明

本节由前端同学继续补充。建议至少包含：

* 主游戏前端技术栈；
* 主游戏前端目录说明；
* 安装依赖命令；
* 开发启动命令；
* 生产构建命令；
* 需要的环境变量或后端接口地址；
* 主要页面和功能说明；
* 常见问题。

当前已知命令：

```bash
npm install
npm run front
npm run build
```

复盘展示前端当前已知命令：

```bash
cd replay_frontend
npm install
npm run dev
npm run build
```

## AI Agent 模块说明

本节由 AI 同学继续补充。建议至少包含：

* AI Agent 代码目录；
* Python/Node/其他运行环境；
* 安装依赖命令；
* 启动命令；
* 默认监听端口；
* 后端需要配置的 `AI_SERVICE_BASE_URL`；
* 支持的接口列表；
* 模型配置方式；
* 推理失败或服务不可用时的处理方式。

后端当前默认通过 `server/service/aiService.js` 调用 AI Agent 服务。

## AI 复盘模块说明

复盘相关依赖位于 `requirements.txt`，当前包含：

```text
flask==2.3.3
flask-cors==4.0.0
openai==1.3.7
httpx==0.27.2
```

安装依赖：

```bash
pip install -r requirements.txt
```

启动复盘服务：

```bash
python ai_replay_service.py
```

后端默认调用地址为：

```text
http://127.0.0.1:8002
```

复盘接口说明可参考：

```text
replay_ai_backend/ai_replayer_API.md
ai_replay_integration_guide.md
```

本节后续可由 AI/复盘同学继续补充模型选择、输入输出示例和运行截图。

## 静态检查

后端 JS 语法检查：

```powershell
Get-ChildItem server -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

复盘 Python 脚本语法检查：

```powershell
python -m py_compile ai_replay_service.py ai_replayer.py replay_ai_backend/ai_replayer.py
```

复盘前端构建检查：

```bash
cd replay_frontend
npm run build
```

主前端构建检查：

```bash
npm run build
```

## 提交与上传注意事项

上传前建议确认：

* `README.md` 中各模块运行方式已补充完整；
* `node_modules/`、日志、缓存、复盘输出文件不作为源码上传；
* `config.json` 已脱敏，真实数据库密码、JWT 密钥、AI Key、语音 Key 不上传；
* 如需提交配置样例，使用 `config.example.json` 或在文档中说明需要自行配置；
* MySQL 建表脚本和初始化脚本随代码一并提交；
* 后端 JS 静态语法检查通过；
* 复盘 Python 脚本编译检查通过；
* 前端和复盘前端构建命令可运行；
* AI、语音、复盘等外部服务地址和启动方式已写清。
