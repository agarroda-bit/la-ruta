import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

let version = 'dev';
try { version = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* sin git */ }

export default defineConfig({
  base: './',
  define: { 'import.meta.env.VITE_VERSION': JSON.stringify(version) },
  build: { target: 'es2020', chunkSizeWarningLimit: 3000, assetsInlineLimit: 0 },
  server: { port: 5173, host: true },
});
