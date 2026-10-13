import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

const here = path.dirname(fileURLToPath(import.meta.url));

// 数据服务器端口与 scripts/dev.mjs 注入的 PORT 保持一致（默认 5178）
const DATA = `http://localhost:${process.env.WXQ_DATA_PORT || '5178'}`;

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@core': path.join(here, '../scripts/lib/assistant-core.mjs') },
  },
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: Number(process.env.WXQ_VITE_PORT || 5173),
    proxy: {
      '/data': DATA,
      '/__': DATA,
      '/api': DATA,
    },
  },
});
