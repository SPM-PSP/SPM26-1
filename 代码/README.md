# 多智能体在线语音狼人杀系统代码说明

本目录收纳了在线狼人杀项目的主要代码，包含主游戏后端、AI 玩家服务、AI 复盘服务、复盘展示前端，以及一份主游戏前端源码。系统目标是支持用户登录、房间管理、多人对局、角色技能结算、投票放逐、语音 STT/TTS、AI 玩家参与和赛后 AI 复盘。

## 项目结构

```text
代码/
├── README.md                         # 本文件，代码总览和启动说明
├── Backend/                          # 主游戏后端源码与 AI 复盘 HTTP 服务
│   ├── app.js                        # 后端启动入口
│   ├── config.json                   # 本地配置文件
│   ├── package.json                  # Node 依赖与脚本
│   ├── server/                       # Node.js/Koa 后端核心源码
│   │   ├── application/              # Koa 应用装载器
│   │   ├── controller/               # 接口控制器
│   │   ├── middleware/               # 鉴权、缓存等中间件
│   │   ├── mysqlModel/               # Sequelize 数据模型
│   │   ├── routes/                   # REST API 路由
│   │   ├── schedule/                 # 定时任务
│   │   └── service/                  # 业务服务
│   ├── sql/                          # MySQL 建表和初始化脚本
│   └── AI-Replay/                    # AI 复盘相关后端文件
│       ├── ai_replay_service.py      # Python 复盘 HTTP 服务，默认端口 8002
│       ├── ai_replayer.py            # 复盘分析工具
│       └── replay_analysis/          # AI 复盘相关分析文件
├── AI-Wolf/                          # AI 玩家与多智能体对局模块
│   ├── ai_backend/                   # Python/FastAPI 
│   │   ├── ai_service/               # 给主游戏后端调用的 AI Service，默认端口 8001
│   │   │   ├── app.py                # AI Service FastAPI 入口
│   │   │   ├── domain/               # 枚举和 Pydantic 结构
│   │   │   ├── prompts/              # 人格与角色基础提示词
│   │   │   ├── repositories/         # 记忆仓储
│   │   │   ├── routers/              # bootstrap、players、memory、invoke 等接口
│   │   │   └── services/             # AI 生成、记忆、人格、LLM、狼人团队共识服务
│   │   ├── config.py                 # .env 配置加载
│   ├── tests/                        # AI 模块 pytest 测试
│   ├── .env.example                  # AI 模块环境变量模板
│   ├── pyproject.toml                # Python 依赖配置
│   └── 接口文档.md                   # AI Service 接口文档
└── frontend/                         # 主游戏前端和复盘展示前端
    ├── client/                       # 主游戏前端源码：登录、房间、对局、语音、复盘跳转
    │   ├── config/                   # 代理、复盘前端地址、WebSocket 地址等
    │   ├── public/
    │   └── src/
    │       ├── api/                  # 后端 API 封装
    │       ├── assets/               # 角色、身份、登录页等静态资源
    │       ├── common/               # fetch、常量、规则、复盘跳转工具
    │       ├── components/           # 通用组件和游戏组件
    │       ├── pages/                # 登录、房间、欢迎页等页面
    │       ├── router/               # 路由配置
    │       └── store/                # 前端状态
    ├── public/                       # 主游戏前端构建产物
    ├── replay-frontend/              # Vue/Vite 复盘展示前端
    │   ├── src/
    │   │   ├── App.vue
    │   │   ├── main.js
    │   │   ├── style.css
    │   │   └── data/                 # 复盘报告适配器、mock 数据和样本文本
    │   ├── dist/                     # 复盘前端构建产物
    │   ├── index.html
    │   ├── package.json
    │   ├── vite.config.js
    │   └── tailwind.config.js
    ├── tests/                        # 前端单元测试
    ├── .env.development              # 主游戏前端开发环境配置
    ├── .env.production               # 主游戏前端生产环境配置
    ├── README.md                     # 前端运行说明
    ├── config-overrides.js           # 主游戏前端构建配置覆盖
    ├── jest.frontend.config.js       # 前端测试配置
    └── package.json                  # 主游戏前端依赖与脚本
```

## 运行环境

| 环境 | 用途 |
|---|---|
| Node.js / npm | 运行前端、主游戏 Node 后端，以及部分辅助脚本 |
| Python 3 | 运行 AI Service 和 AI 复盘服务 |
| MySQL | 主游戏后端数据持久化 |
| 浏览器 | 访问主游戏前端和复盘展示页 |
| 大模型/语音服务凭证 | AI 玩家、AI 复盘、STT/TTS 联调时使用 |


## 前端运行

### 主游戏前端

配置后端地址：

```js
// client/config/config-default.js
proxy: [
  {
    context: ['/api'],
    target: 'http://后端IP:6001',
    changeOrigin: true,
  },
]

websocket: {
  dev: '后端IP',
  prd: '120.48.51.123',
}

replayFrontendUrl: 'http://复盘前端IP:5173'
```

运行：

```bash
cd /home/yangceh/SPM26-1/代码/frontend
HTTPS=true HOST=0.0.0.0 PORT=6002 npm run front
```

访问：

```text
https://本机IP:6002
```

### 复盘前端

运行：

```bash
cd /home/yangceh/SPM26-1/代码/frontend/replay-frontend
npm run dev
```

访问：

```text
http://本机IP:5173
```

如果需要单独指定后端地址：

```bash
cd /home/yangceh/SPM26-1/代码/frontend/replay-frontend
VITE_API_PROXY_TARGET=http://后端IP:6001 npm run dev
```

### 依赖安装

主游戏前端：

```bash
cd /home/yangceh/SPM26-1/代码/frontend
npm install
```

复盘前端：

```bash
cd /home/yangceh/SPM26-1/代码/frontend/replay-frontend
npm install
```

### 测试脚本

```bash
cd /home/yangceh/SPM26-1/代码/frontend
npm run test:frontend
```


## 主游戏后端

后端工程根目录位于 `Backend/`，核心源码在 `Backend/server/`，基于 Koa 2、Sequelize、MySQL 和 nodejs-websocket。核心职责包括登录鉴权、房间管理、游戏阶段推进、角色技能结算、投票放逐、语音接口、AI 玩家调度和复盘触发。

### 启动方式

```bash
cd 代码/Backend
npm install
npm run server
```

默认 HTTP 端口由 `config.json` 的 `port` 决定，现有文档记录为 `6001`。WebSocket 服务由应用装载器监听 `6003`，房间连接路径为：

```text
/lrs/{roomId}
```

### 配置

后端主要读取 `config.json`，并支持环境变量覆盖部分外部服务。

| 配置项或环境变量 | 说明 |
|---|---|
| `port` | Koa HTTP 服务端口 |
| `mysql.local` / `mysql.dev` / `mysql.prd` | MySQL 连接配置 |
| `jwt.secret` | JWT 签名密钥 |
| `crypto.secret` | 密码加密密钥 |
| `AI_SERVICE_BASE_URL` / `aiService.baseUrl` | AI Service 地址，默认建议 `http://127.0.0.1:8001` |
| `AI_REPLAY_SERVICE_BASE_URL` / `aiReplayService.baseUrl` | AI 复盘服务地址，默认建议 `http://127.0.0.1:8002` |
| `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL` | 复盘大模型兼容配置 |
| `VOLCENGINE_API_KEY`、`VOLCENGINE_UID` | 火山引擎语音服务凭证 |
| `VOLCENGINE_STT_URL`、`VOLCENGINE_TTS_URL` | STT/TTS 接口地址 |
| `VOICE_SERVICE_TIMEOUT` | 语音服务超时时间 |


## AI Service

AI Service 位于 `AI-Wolf/ai_backend/ai_service/`，是给主游戏后端调用的独立 FastAPI 服务。它负责 AI 玩家生成、角色同步、人格分配、记忆维护、公共事件广播、阶段决策和全 AI 狼队夜间共识。

### 安装与配置

```bash
cd 代码/AI-Wolf
pip install -r requirements.txt
```

编辑 `.env`，至少配置模型提供商和对应 Key。`requirements.txt` 包含远程模型服务所需的基础依赖；如果启用 `MODEL_PROVIDER=local_hf`，还需要按本机 CUDA/conda 环境补充安装 `torch`、`transformers`、`accelerate`、`bitsandbytes` 等本地模型依赖。

常用配置包括：

| 变量 | 说明 |
|---|---|
| `MODEL_PROVIDER` | `dashscope`、`zhipu`、`openai`、`ollama`、`local_hf` 等 |
| `DASHSCOPE_API_KEY` / `DASHSCOPE_MODEL_NAME` | DashScope 模型配置 |
| `ZHIPU_API_KEY` / `ZHIPU_BASE_URL` / `ZHIPU_MODEL_NAME` | 智谱 OpenAI-compatible 配置 |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL_NAME` | OpenAI 兼容模型配置 |
| `OPENAI_PLAYER_MODE` | `single` 共用模型，或 `per-player` 按玩家单独配置 |
| `OPENAI_API_KEY_P1..P9` | 每个玩家独立模型配置，`per-player` 模式使用 |


### 启动

```bash
cd 代码/AI-Wolf
python -m uvicorn ai_backend.ai_service.app:app --host 0.0.0.0 --port 8001 --reload
```

验证：

```bash
curl http://127.0.0.1:8001/health
```

测试：

```bash
cd 代码/AI-Wolf
python -m pytest tests/test_ai_player.py -q
```

## AI 复盘服务

复盘服务位于 `AI-Replay/ai_replay_service.py`，基于 Flask 实现，对主游戏后端暴露 HTTP 分析接口。它会调用 `AI-Replay/ai_replayer.py` 生成结构化 JSON 和可读文本报告，输出到 `AI-Replay/replay_analysis/`。

### 安装与启动

请确保 Python 环境中已安装：

```text
flask
flask-cors
openai
httpx
```

启动：

```bash
cd 代码/Backend
python ai_replay_service.py
```

可选环境变量：

| 变量 | 说明 |
|---|---|
| `AI_REPLAY_PORT` | 复盘服务端口，默认 `8002` |
| `AI_REPLAY_DEBUG` | Flask debug 开关 |
| `AI_REPLAY_SERVICE_BASE_URL` | 主后端调用复盘服务的地址 |
| `REPLAY_AI_API_KEY` / `REPLAY_AI_MODEL` / `REPLAY_AI_BASE_URL` | 复盘大模型配置 |
| `REPLAY_OUTPUT_DIR` | 复盘输出目录 |
| `REPLAY_ENABLE_AI` | 是否启用大模型复盘 |


## 语音 STT/TTS

语音功能由主游戏后端 `Backend/server/service/voiceService.js` 和 `Backend/server/controller/voiceController.js` 实现。

| 接口 | 说明 |
|---|---|
| `POST /api/voice/stt/auth` | 上传音频并转写文本，支持 multipart 文件或 `audioBase64` |
| `POST /api/voice/tts/auth` | 文本转 MP3，返回 `audio/mpeg` |
| `POST /api/voice/speech/auth` | 玩家发言提交，校验阶段、存活状态和当前发言轮次 |

语音服务依赖火山引擎配置。未配置 `VOLCENGINE_API_KEY` 或 `voiceService.apiKey` 时，接口会返回未配置相关错误。

## 数据模型

主游戏后端模型位于 `Backend/server/mysqlModel/`。

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
