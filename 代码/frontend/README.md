# 前端运行

## 主游戏前端

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

## 复盘前端

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

## 依赖安装

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

