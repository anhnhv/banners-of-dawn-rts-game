import { cpSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/**
 * Build environment. Vite's own .env loading is turned off (`envDir: false`): the only env file is
 * `.env.prod` (git-ignored, template in .env.example), and it is read only by the deploy build
 * (`vite build --mode prod`, see scripts/deploy.sh). Every other build has no Firebase config,
 * so it has no analytics. Only the VITE_FIREBASE_* keys are passed to the client code.
 * `envPrefix` is set to a name nothing uses, so shell variables (e.g. VITE_FIREBASE_* exported in
 * CI) cannot reach the client either: the bundle and the CSP always come from .env.prod alone.
 */
const UNUSED_ENV_PREFIX = 'BOD_ENV_FILES_DISABLED_';
const ENV_FILE = resolve(ROOT, '.env.prod');
function loadProdEnv(mode: string): Record<string, string> {
  if (mode !== 'prod') return {};
  if (!existsSync(ENV_FILE))
    throw new Error('--mode prod needs .env.prod (copy .env.example and fill it in)');
  const parsed = parseEnv(readFileSync(ENV_FILE, 'utf8'));
  return Object.fromEntries(
    Object.entries(parsed).filter((e): e is [string, string] => e[0].startsWith('VITE_FIREBASE_') && !!e[1]),
  );
}

/** Same condition as src/host/analytics.ts: the minimum Firebase config Analytics needs. */
const hasAnalyticsConfig = (env: Record<string, string>): boolean =>
  !!env.VITE_FIREBASE_API_KEY && !!env.VITE_FIREBASE_APP_ID && !!env.VITE_FIREBASE_MEASUREMENT_ID;

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
 * Hosts Google Analytics needs, from Google's CSP guide, the table for Google Analytics
 * *without* Google Ads features (this game uses no ads, no Google Signals):
 * https://developers.google.com/tag-platform/security/guides/csp
 */
const GA_TAG_MANAGER = 'https://www.googletagmanager.com';
const GA_HITS = 'https://*.google-analytics.com';
const ANALYTICS_CSP = {
  scripts: [GA_TAG_MANAGER],
  images: [GA_TAG_MANAGER, GA_HITS],
  connect: [
    GA_TAG_MANAGER,
    GA_HITS,
    'https://*.google.com',
    // Not in the GA guide: Firebase's own config and installation endpoints (@firebase/analytics).
    'https://firebase.googleapis.com',
    'https://firebaseinstallations.googleapis.com',
  ],
};

/**
 * Content Security Policy: the page may only talk to its own origin.
 * This backs up the "no external AI / no network" rule (PLAN §6.2).
 * In dev, the Vite HMR websocket on localhost is allowed too.
 * In the deploy build with analytics configured (.env.prod, see above), Google Analytics (via
 * Firebase, src/host/analytics.ts) is the one exception: only its own Google hosts are allowed.
 * Without that config, the strict policy is kept.
 */
function contentSecurityPolicy(withAnalytics: boolean): Plugin {
  let isDev = false;
  let analytics = false;
  return {
    name: 'bod:csp',
    configResolved(config) {
      isDev = config.command === 'serve';
      analytics = withAnalytics && !isDev;
    },
    transformIndexHtml() {
      const ga = (hosts: string[]): string => (analytics ? ` ${hosts.join(' ')}` : '');
      const devConnect = isDev ? ' ws://localhost:* ws://127.0.0.1:*' : '';
      const policy = [
        "default-src 'self'",
        `script-src 'self'${ga(ANALYTICS_CSP.scripts)}`,
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' data: blob:${ga(ANALYTICS_CSP.images)}`,
        "font-src 'self'",
        "media-src 'self' blob:",
        `connect-src 'self'${devConnect}${ga(ANALYTICS_CSP.connect)}`,
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

export default defineConfig(({ mode }) => {
  const prodEnv = loadProdEnv(mode);
  return {
    root: ROOT,
    publicDir: false,
    envDir: false,
    envPrefix: UNUSED_ENV_PREFIX,
    define: Object.fromEntries(
      Object.entries(prodEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
    plugins: [contentSecurityPolicy(hasAnalyticsConfig(prodEnv)), copyStaticDirs()],
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
      include: ['tests/**/*.test.ts', 'ai/tests/**/*.test.ts'],
      environment: 'node',
      testTimeout: 30_000,
    },
  };
});
