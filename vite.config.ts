import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/** Top-level data folders that are served as-is in dev and copied into dist/ on build. */
const STATIC_DIRS = ['maps', 'assets'];

/**
 * Maps and generated assets live in top-level folders (separate from code, see PLAN §3).
 * Vite already serves them in dev because they sit under the project root;
 * this plugin copies them into the build output.
 */
function copyStaticDirs(): Plugin {
  let outDir = resolve(ROOT, 'dist');
  return {
    name: 'bod:copy-static-dirs',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      for (const dir of STATIC_DIRS) {
        const from = resolve(ROOT, dir);
        if (existsSync(from)) cpSync(from, resolve(outDir, dir), { recursive: true });
      }
    },
  };
}

/**
 * Content Security Policy: the page may only talk to its own origin.
 * This backs up the "no external AI / no network" rule (PLAN §6.2).
 * In dev, the Vite HMR websocket on localhost is allowed too.
 */
function contentSecurityPolicy(): Plugin {
  let isDev = false;
  return {
    name: 'bod:csp',
    configResolved(config) {
      isDev = config.command === 'serve';
    },
    transformIndexHtml() {
      const connect = isDev ? "'self' ws://localhost:* ws://127.0.0.1:*" : "'self'";
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "media-src 'self' blob:",
        `connect-src ${connect}`,
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ].join('; ');
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  root: ROOT,
  publicDir: false,
  plugins: [contentSecurityPolicy(), copyStaticDirs()],
  worker: { format: 'es' },
  build: {
    outDir: 'dist',
    // Keep Vite's JS/CSS chunks away from our own top-level `assets/` (generated game art).
    assetsDir: 'bundle',
    emptyOutDir: true,
    target: 'es2023',
    // three.js alone is ~550 kB minified; split chunks later if load time matters.
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
