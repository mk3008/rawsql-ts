export function shouldWarmupMultiplier(
  multiplier: number,
  baselineMultiplier: number,
  warmupRuns: number,
): boolean {
  return multiplier === baselineMultiplier && warmupRuns > 0;
}

export function resolveMeasuredRunsForMultiplier(multiplier: number, measuredRuns: number): number {
  void multiplier;
  return measuredRuns;
}

export function resolveLowerBoundMeasuredRuns(
  measuredRuns: number,
  measuredRunsOverridden: boolean,
  benchProfileName: string,
): number {
  if (measuredRunsOverridden || benchProfileName !== 'dev') {
    return measuredRuns;
  }
  return 1;
}

export function formatRunPlan(
  suiteMultipliers: number[],
  baselineMultiplier: number,
  caseCount: number,
  warmupRuns: number,
  measuredRunsByMultiplier: (multiplier: number) => number,
): string {
  return suiteMultipliers
    .map((multiplier) => {
      const warmups = shouldWarmupMultiplier(multiplier, baselineMultiplier, warmupRuns)
        ? warmupRuns
        : 0;
      const measured = measuredRunsByMultiplier(multiplier);
      const suiteSize = caseCount * multiplier;
      return `${suiteSize} tests: ${warmups} warmup / ${measured} measured`;
    })
    .join('; ');
}
