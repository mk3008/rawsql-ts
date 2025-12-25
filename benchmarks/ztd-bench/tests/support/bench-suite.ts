const DEFAULT_SUITE_MULTIPLIER = 1;

export function resolveSuiteMultiplier(): number {
  const raw = Number(process.env.SUITE_MULTIPLIER ?? DEFAULT_SUITE_MULTIPLIER);
  // Clamp to a sane minimum so the benchmark always runs at least once.
  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_SUITE_MULTIPLIER;
  }
  return Math.floor(raw);
}

export function buildBenchSchemaName(caseName: string, token: string): string {
  const workerToken = process.env.VITEST_WORKER_ID ?? process.pid.toString();
  // Encode worker + token to keep fixture namespaces unique per repetition.
  const combined = `${caseName}_${workerToken}_${token}`;
  return combined.replace(/[^a-z0-9]+/giu, '_').toLowerCase();
}
