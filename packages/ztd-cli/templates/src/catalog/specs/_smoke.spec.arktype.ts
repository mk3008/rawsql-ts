import { type } from 'arktype';

/**
 * Validator invariant contract used to prove the minimal onboarding gate.
 *
 * The reusable QuerySpec-first example lives in `tests/queryspec.example.test.ts`.
 *
 * This file is intentionally minimal and domain-agnostic.
 */
export const smokeOutputSchema = type({
  id: 'number.integer',
  createdAt: 'Date'
});

export type SmokeOutput = ReturnType<typeof smokeOutputSchema>;

/**
 * Parse and validate an unknown runtime payload.
 */
export function parseSmokeOutput(value: unknown): SmokeOutput {
  smokeOutputSchema.assert(value);
  return value as SmokeOutput;
}
