export function formatMs(value: number): string {
  if (value < 1) {
    return value.toFixed(3);
  }
  return value.toFixed(2);
}

export function formatOptionalMs(value?: number, placeholder = 'N/A'): string {
  return typeof value === 'number' ? formatMs(value) : placeholder;
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function stddev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const avg = average(values);
  const variance = average(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  // Sort a copy so we can pick the middle element without mutating caller data.
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computePercentile(values: number[], percentile: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const clamped = Math.min(1, Math.max(0, percentile));
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(clamped * sorted.length) - 1));
  return sorted[index];
}
