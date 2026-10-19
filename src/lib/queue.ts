/** Runs async tasks with at most `limit` in flight at once. */
export function createQueue(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  const next = () => {
    active--;
    waiting.shift()?.();
  };

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        task().then(resolve, reject).finally(next);
      };
      if (active < limit) run();
      else waiting.push(run);
    });
  };
}
