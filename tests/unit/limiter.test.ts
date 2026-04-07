import { describe, it, expect } from "vitest";
import { RequestLimiter } from "../../src/core/limiter";

describe("RequestLimiter", () => {
  it("allows initial burst up to capacity", async () => {
    const limiter = new RequestLimiter({ capacity: 3, refillRatePerSecond: 1 });
    
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
  });

  it("throttles requests when tokens are exhausted", async () => {
    const limiter = new RequestLimiter({ capacity: 1, refillRatePerSecond: 2 }); // 1 token every 0.5s
    
    await limiter.acquire(); // Consumes initial token
    
    const start = Date.now();
    await limiter.acquire(); // Should wait ~500ms
    const duration = Date.now() - start;
    
    expect(duration).toBeGreaterThanOrEqual(450);
    expect(duration).toBeLessThan(600);
  });
});
