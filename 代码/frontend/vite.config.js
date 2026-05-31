import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const clientConfig = require("../client/config/config-default.js");
const apiProxy = (clientConfig.proxy || []).find((item) => item && item.target);

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || apiProxy?.target || "http://127.0.0.1:6001",
        changeOrigin: true,
      },
    },
  },
});
