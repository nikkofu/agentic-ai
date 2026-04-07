export interface LimiterOptions {
  capacity: number;
  refillRatePerSecond: number;
}

export class RequestLimiter {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;
  private refillRatePerSecond: number;

  constructor(options: LimiterOptions) {
    this.capacity = options.capacity;
    this.refillRatePerSecond = options.refillRatePerSecond;
    this.tokens = options.capacity;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerSecond);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitTime = (1 - this.tokens) / this.refillRatePerSecond * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return this.acquire(); // Retry after waiting
  }
}
