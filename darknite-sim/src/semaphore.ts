/**
 * Counting semaphore for concurrency control.
 * All concurrent action dispatches must go through this.
 */
export class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (limit < 1) throw new Error('Semaphore limit must be >= 1');
  }

  async acquire(): Promise<void> {
    if (this.current < this.limit) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      // Hand the slot directly to the next waiter
      next();
    } else {
      this.current--;
    }
  }

  /**
   * Acquire, run fn, release. Always releases in finally block.
   */
  async wrap<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.current;
  }
}
