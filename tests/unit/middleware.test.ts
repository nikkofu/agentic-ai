import { describe, it, expect, vi } from 'vitest';
import { MiddlewareManager } from '../../src/core/middleware';

describe('MiddlewareManager', () => {
  it('should execute middlewares in onion model order', async () => {
    const manager = new MiddlewareManager<{ data: string[] }>();
    const order: number[] = [];

    manager.use(async (ctx, next) => {
      order.push(1);
      ctx.data.push('a');
      await next();
      order.push(6);
      ctx.data.push('f');
    });

    manager.use(async (ctx, next) => {
      order.push(2);
      ctx.data.push('b');
      await next();
      order.push(5);
      ctx.data.push('e');
    });

    manager.use(async (ctx, next) => {
      order.push(3);
      ctx.data.push('c');
      await next();
      order.push(4);
      ctx.data.push('d');
    });

    const context = { data: [] as string[] };
    const coreFn = vi.fn(async () => {
      order.push(100);
      context.data.push('core');
    });

    await manager.execute(context, coreFn);

    expect(order).toEqual([1, 2, 3, 100, 4, 5, 6]);
    expect(context.data).toEqual(['a', 'b', 'c', 'core', 'd', 'e', 'f']);
    expect(coreFn).toHaveBeenCalledOnce();
  });

  it('should throw if next() is called multiple times', async () => {
    const manager = new MiddlewareManager<any>();
    
    manager.use(async (ctx, next) => {
      await next();
      await next(); // Should throw
    });

    await expect(manager.execute({}, async () => {})).rejects.toThrow("next() called multiple times");
  });
});
