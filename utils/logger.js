/**
 * Logging utility with production-ready error tracking
 * - Development: Logs to console with full details
 * - Production: Logs errors to console (can be extended with Sentry/LogRocket)
 */

const __DEV__ = process.env.NODE_ENV !== 'production';

class Logger {
  constructor() {
    this.enabled = true; // Always enabled, but level varies by environment
    this.errorTrackingEnabled = !__DEV__; // Enable error tracking in production
  }

  /**
   * Sanitize sensitive data from error objects
   */
  sanitizeError(error) {
    if (!error) return error;
    
    // Remove sensitive fields if error is an object
    if (typeof error === 'object' && error !== null) {
      const sanitized = { ...error };
      // Remove potential PII/sensitive data
      delete sanitized.password;
      delete sanitized.email;
      delete sanitized.token;
      delete sanitized.secret;
      return sanitized;
    }
    
    return error;
  }

  /**
   * Format error for logging/tracking
   */
  formatError(...args) {
    return args.map(arg => {
      if (arg instanceof Error) {
        return {
          message: arg.message,
          stack: arg.stack,
          name: arg.name,
        };
      }
      return this.sanitizeError(arg);
    });
  }

  log(...args) {
    if (this.enabled) {
      console.log(...args);
    }
  }

  error(...args) {
    // Always log errors, even in production
    const formatted = this.formatError(...args);
    console.error(...formatted);

    // In production, could send to error tracking service
    // Example: Sentry.captureException(...)
    if (this.errorTrackingEnabled && typeof window !== 'undefined') {
      // Placeholder for error tracking service integration
      // TODO: Integrate Sentry or similar service
      // Sentry.captureException(formatted[0], { extra: formatted.slice(1) });
    }
  }

  warn(...args) {
    if (this.enabled) {
      console.warn(...args);
    }
  }

  info(...args) {
    if (this.enabled) {
      console.info(...args);
    }
  }

  debug(...args) {
    // Only in development
    if (__DEV__) {
      console.debug(...args);
    }
  }

  // Tagged logging for better organization
  tag(tag) {
    return {
      log: (...args) => this.log(`[${tag}]`, ...args),
      error: (...args) => this.error(`[${tag}]`, ...args),
      warn: (...args) => this.warn(`[${tag}]`, ...args),
      info: (...args) => this.info(`[${tag}]`, ...args),
      debug: (...args) => this.debug(`[${tag}]`, ...args),
    };
  }
}

export default new Logger();

