import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, '../../.env');

const readRootEnv = () => {
  if (!fs.existsSync(rootEnvPath)) return {};

  return fs
    .readFileSync(rootEnvPath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return env;

      const [key, ...valueParts] = trimmed.split('=');
      env[key.trim()] = valueParts.join('=').trim();
      return env;
    }, {});
};

const rootEnv = readRootEnv();
const publicHttpPort = process.env.PUBLIC_HTTP_PORT || rootEnv.PUBLIC_HTTP_PORT;
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ||
  (publicHttpPort ? `http://localhost:${publicHttpPort}` : 'http://localhost');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
