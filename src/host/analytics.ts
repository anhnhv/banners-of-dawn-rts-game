/**
 * Google Analytics through Firebase (page views and visits only).
 * Optional and deploy-only: it runs only in the deploy build (`vite build --mode prod`), which reads
 * the VITE_FIREBASE_* values from .env.prod (see .env.example, vite.config.ts). Dev servers, tests,
 * plain `npm run build` and forks without that file never load it, so they send nothing to anyone.
 * The Firebase SDK is loaded as a separate chunk, so it never delays the game's start.
 * The hosts it talks to are allowed in the production CSP (vite.config.ts) under the same condition.
 * The engine and the machine player stay network-free (PLAN §6.2); only this module uses it.
 */

/**
 * The Firebase web config from .env.prod, or null when analytics is not configured.
 * Each value is written as `import.meta.env.VITE_…` in full: vite.config.ts replaces these exact
 * expressions at build time.
 */
function firebaseConfig() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };
  // These three are the minimum Analytics needs; the rest are optional.
  if (!config.apiKey || !config.appId || !config.measurementId) return null;
  return config;
}

export async function startAnalytics(): Promise<void> {
  if (!import.meta.env.PROD) return;
  const config = firebaseConfig();
  if (!config) return;
  try {
    const [{ initializeApp }, { getAnalytics, isSupported }] = await Promise.all([
      import('firebase/app'),
      import('firebase/analytics'),
    ]);
    if (!(await isSupported())) return;
    getAnalytics(initializeApp(config));
  } catch (err) {
    // Analytics must never break the game (blocked by an ad blocker, offline, ...).
    console.info('Analytics unavailable:', err);
  }
}
