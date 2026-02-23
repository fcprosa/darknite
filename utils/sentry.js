/**
 * Sentry initialization
 * This file should be imported as early as possible in your app
 */

import Constants from "expo-constants";
import * as SentryModule from '@sentry/react-native';

const __DEV__ = process.env.NODE_ENV !== 'production';

let Sentry = SentryModule;
let isInitialized = false;

const SENTRY_DSN =
  Constants.expoConfig?.extra?.sentryDsn ||
  Constants.manifest?.extra?.sentryDsn ||
  process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Initialize Sentry if DSN is configured
 * Returns the Sentry instance or null if not available
 */
export function initSentry() {
  if (isInitialized) {
    return Sentry;
  }

  // Check if already initialized by checking Sentry's internal state
  if (Sentry && Sentry.getCurrentHub && Sentry.getCurrentHub().getClient()) {
    console.log('[Sentry] Already initialized (initialized elsewhere)');
    isInitialized = true;
    return Sentry;
  }

  // Use DSN from App.js initialization if available, otherwise use env
  const dsnToUse = SENTRY_DSN;

  if (!dsnToUse) {
    console.log('[Sentry] DSN not configured, skipping initialization');
    isInitialized = true;
    return null;
  }

  try {
    // Only initialize if not already initialized
    if (!Sentry.getCurrentHub || !Sentry.getCurrentHub().getClient()) {
      Sentry.init({
        dsn: dsnToUse,
        
        // Adds more context data to events (IP address, cookies, user, etc.)
        sendDefaultPii: false,
        
        // Enable Logs
        enableLogs: __DEV__,
        
        // Session Replay disabled for V1 (App Store privacy compliance)
        // replaysSessionSampleRate: 0.1,
        // replaysOnErrorSampleRate: 1,
        integrations: [Sentry.feedbackIntegration()],
        
        enableInExpoDevelopment: false, // Set to true to test in dev mode
        environment: process.env.NODE_ENV || 'development',
        
        // Configure which errors to capture
        beforeSend(event, hint) {
          // You can customize this to filter specific errors
          // Uncomment the line below to disable Sentry in development completely
          // if (process.env.NODE_ENV === 'development') return null;
          return event;
        },
        
        // Attach stack traces to all errors
        attachStacktrace: true,
        
        // Set sample rate for performance monitoring (1.0 = 100%, 0.1 = 10%)
        tracesSampleRate: 0.1,
        
        // Configure release tracking
        release: Constants.expoConfig?.version || '1.0.0',
      });
      
      console.log('[Sentry] Initialized successfully');
    }
    
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

// Auto-initialize when this module is imported (but check if already initialized)
initSentry();
