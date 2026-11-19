/** No catch-up queue: timer ticks during a slow run share that run. */
export function startHmsSyncScheduler(
  sync: () => Promise<unknown>,
  intervalMs: number,
  onError: (error: unknown) => void,
) {
  let stopped = false;
  let active: Promise<unknown> | undefined;
  const run = () => {
    if (stopped || active) return;
    active = Promise.resolve().then(sync).catch(onError).finally(() => { active = undefined; });
  };
  const initial = setTimeout(run, 2_000);
  const periodic = setInterval(run, intervalMs);
  initial.unref();
  periodic.unref();
  return async () => {
    stopped = true;
    clearTimeout(initial);
    clearInterval(periodic);
    await active;
  };
}
