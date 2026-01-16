/**
 * Sentry initialization
 * This file should be imported as early as possible in your app
 */

import Constants from "expo-constants";

let Sentry = null;
let isInitialized = false;

const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn || 
                   Constants.manifest?.extra?.sentryDsn;

/**
 * Initialize Sentry if DSN is configured
 * Returns the Sentry instance or null if not available
 */
export function initSentry() {
  if (isInitialized) {
    return Sentry;
  }

  if (!SENTRY_DSN) {
    console.log('[Sentry] DSN not configured, skipping initialization');
    isInitialized = true;
    return null;
  }

  try {
    Sentry = require('@sentry/react-native');
    
    Sentry.init({
      dsn: SENTRY_DSN,
      enableInExpoDevelopment: false, // Set to true to test in dev mode
      environment: process.env.NODE_ENV || 'development',
      
      // Configure which errors to capture
      beforeSend(event, hint) {
        // Filter out development-only errors if needed
        // You can customize this to filter specific errors
        if (process.env.NODE_ENV === 'development' && !__DEV__) {
          // Uncomment to disable Sentry in development completely
          // return null;
        }
        return event;
      },
      
      // Attach stack traces to all errors
      attachStacktrace: true,
      
      // Set sample rate for performance monitoring (1.0 = 100%, 0.1 = 10%)
      tracesSampleRate: 1.0,
      
      // Configure release tracking
      release: Constants.expoConfig?.version || '1.0.0',
      
      // Set up default integrations
      integrations: [
        // Sentry's default integrations are added automatically
      ],
    });
    
    console.log('[Sentry] Initialized successfully');
    isInitialized = true;
    return Sentry;
  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error.message);
    // App continues to work even if Sentry fails to initialize
    isInitialized = true;
    return null;
  }
}

/**
 * Get the Sentry instance (call initSentry first)
 */
export function getSentry() {
  return Sentry;
}

// Auto-initialize when this module is imported
initSentry();
