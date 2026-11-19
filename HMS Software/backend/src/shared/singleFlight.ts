/** Coalesce concurrent calls in this worker without caching results or failures. */
export function singleFlight<T>(run: () => Promise<T>) {
  let active: Promise<T> | undefined;
  return () => {
    if (!active) {
      active = Promise.resolve().then(run).finally(() => { active = undefined; });
    }
    return active;
  };
}
