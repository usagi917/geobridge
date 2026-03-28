/**
 * Run async tasks with limited concurrency using a worker-pool pattern.
 * Returns PromiseSettledResult[] so callers can inspect individual failures.
 */
export async function allSettledWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<Array<PromiseSettledResult<T>>> {
  if (tasks.length === 0) return [];

  const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        results[currentIndex] = {
          status: "fulfilled",
          value: await tasks[currentIndex](),
        };
      } catch (error) {
        results[currentIndex] = {
          status: "rejected",
          reason: error,
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  );

  return results;
}

/**
 * Map items with limited concurrency, collecting results in order.
 * Uses allSettled internally — individual mapper failures are collected,
 * not thrown, so all items get a chance to run.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const tasks = items.map((item) => () => mapper(item));
  const settled = await allSettledWithConcurrency(tasks, limit);

  return settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    throw result.reason ?? new Error(`Task ${i} failed`);
  });
}
