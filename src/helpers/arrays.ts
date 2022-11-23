export const toArray = <T>(items: T | Array<T>): Array<T> => {
  return Array.isArray(items) ? items : [items];
};

export const chunkArray = <T>(items: Array<T>, chunkSize: number): Array<Array<T>> => {
  const totalChunks = Math.ceil(items.length / chunkSize);

  const chunks = new Array<Array<T>>(totalChunks);
  for (let i = 0; i < totalChunks; i += 1) {
    chunks[i] = items.slice(i * chunkSize, (i + 1) * chunkSize);
  }

  return chunks;
};

type ValueOrArray<T> = T | Array<ValueOrArray<T>>;
type RecursiveArray<T> = Array<ValueOrArray<T>>;
export const flattenDeep = <T>(array: RecursiveArray<T>): Array<T> =>
  array.flatMap((subArray) => (Array.isArray(subArray) ? flattenDeep(subArray) : subArray));
