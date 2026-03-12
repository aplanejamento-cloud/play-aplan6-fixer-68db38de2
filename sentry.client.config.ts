import * as Sentry from '@sentry/react';

Sentry.init({
  // PLACEHOLDER: substitua pelo seu DSN real do Sentry
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.DEV ? 'development' : 'production',
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  beforeSend(event) {
    // Remove dados sensíveis
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});

export default Sentry;
