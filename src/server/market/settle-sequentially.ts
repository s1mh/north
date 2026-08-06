export async function settleSequentially<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
) {
  const results: Array<PromiseSettledResult<R>> = [];
  for (const item of items) {
    try {
      results.push({ status: "fulfilled", value: await operation(item) });
    } catch (reason) {
      results.push({ status: "rejected", reason });
    }
  }
  return results;
}
