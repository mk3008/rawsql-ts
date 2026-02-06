import { parseSmokeOutput, type SmokeOutput } from '../specs/_smoke.spec';
import { normalizeTimestamp } from './_coercions';

/**
 * Validate runtime output against the catalog smoke invariant.
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
