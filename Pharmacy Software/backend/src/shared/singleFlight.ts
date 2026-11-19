/** Share only an in-flight run; failures never prevent a later retry. Process-local. */
export function singleFlight<T>(run: () => Promise<T>) {
  let active: Promise<T> | undefined;
  return () => {
    if (!active) {
      active = Promise.resolve().then(run).finally(() => { active = undefined; });
    }
    return active;
  };
}
