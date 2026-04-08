export type Middleware<T> = (ctx: T, next: () => Promise<void>) => Promise<void>;

export class MiddlewareManager<T> {
  private middlewares: Middleware<T>[] = [];

  use(middleware: Middleware<T>) {
    this.middlewares.push(middleware);
  }

  async execute(context: T, coreFn: () => Promise<void>): Promise<void> {
    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      if (i === this.middlewares.length) {
        await coreFn();
        return;
      }
      const middleware = this.middlewares[i];
      await middleware(context, dispatch.bind(null, i + 1));
    };
    await dispatch(0);
  }
}
