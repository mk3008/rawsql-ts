import { z } from 'zod';

/**
 * Validator invariant contract used to prove runtime validation wiring.
 *
 * This file is intentionally minimal and domain-agnostic.
 */
export const smokeOutputSchema = z.object({
  id: z.number().int(),
  createdAt: z.date()
});

export type SmokeOutput = z.infer<typeof smokeOutputSchema>;

/**
 * Parse and validate an unknown runtime payload.
 */
export function parseSmokeOutput(value: unknown): SmokeOutput {
  return smokeOutputSchema.parse(value);
}
