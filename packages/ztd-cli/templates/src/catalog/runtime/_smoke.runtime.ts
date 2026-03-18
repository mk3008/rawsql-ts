import { parseSmokeOutput, type SmokeOutput } from '../specs/_smoke.spec.js';
import { normalizeTimestamp } from './_coercions.js';

/**
 * Validate runtime output against the catalog smoke invariant.
 *
 * The reusable QuerySpec-first sample lives in `tests/queryspec.example.test.ts`.
 */
export function ensureSmokeOutput(value: unknown): SmokeOutput {
  // Normalize driver-dependent timestamp representations before contract validation.
  if (isRecord(value) && 'createdAt' in value) {
    return parseSmokeOutput({
      ...value,
      createdAt: normalizeTimestamp(value.createdAt, 'createdAt')
    });
  }

  return parseSmokeOutput(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
