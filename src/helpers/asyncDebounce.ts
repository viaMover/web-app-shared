const promises: Record<string, unknown> = {};

export const asyncDebounce = <TArgs extends unknown[], TReturn>(
  fn: (...parameters: TArgs) => TReturn,
  ...args: TArgs
): TReturn => {
  const debounceKey = fn.name + JSON.stringify(args);
  const runningPromise = promises[debounceKey];
  if (runningPromise !== undefined) {
    return runningPromise as unknown as TReturn;
  }

  const fetchPromise = fn(...args) as unknown as TReturn;
  promises[debounceKey] = fetchPromise;
  Promise.resolve(fetchPromise)
    .then(() => {
      delete promises[debounceKey];
    })
    .catch(() => {
      delete promises[debounceKey];
    });

  return fetchPromise;
};
