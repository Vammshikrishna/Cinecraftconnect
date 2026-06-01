import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENV = import.meta.env.MODE || "development";

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: ENV === "production" ? 0.1 : 1.0, // 10% in production, 100% in development
    // Session Replay
    replaysSessionSampleRate: 0.05, // 5% session replay rate
    replaysOnErrorSampleRate: 1.0, // 100% replay on error
  });
  console.log(`[SENTRY] Initialized successfully in ${ENV} mode.`);
} else {
  console.warn("[SENTRY] VITE_SENTRY_DSN is not defined. Sentry is running in mock/offline mode.");
}

export { Sentry };
