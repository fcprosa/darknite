/**
 * Development-only logging utility
 * In production, logs are disabled to improve performance
 */

const __DEV__ = process.env.NODE_ENV !== 'production';

class Logger {
  constructor() {
    this.enabled = __DEV__;
  }

  log(...args) {
    if (this.enabled) {
      console.log(...args);
    }
  }

  error(...args) {
    if (this.enabled) {
      console.error(...args);
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
    if (this.enabled) {
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

