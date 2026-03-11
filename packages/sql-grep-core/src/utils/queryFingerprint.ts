import { createHash } from 'node:crypto';

/**
 * Fixed fingerprint length used in machine-facing outputs.
 */
export const QUERY_FINGERPRINT_LENGTH = 12;

/**
 * Normalize SQL text for stable statement fingerprinting.
 *
 * Fingerprint normalization is a compatibility contract for Issue #478.
 */
export function normalizeQueryFingerprintSource(sql: string): string {
  const withoutLineComments = sql
    .split('\n')
    .map((line) => {
      const commentStart = line.indexOf('--');
      return commentStart >= 0 ? line.slice(0, commentStart) : line;
    })
    .join('\n');

  const withoutBlockComments = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return withoutBlockComments.replace(/\s+/g, ' ').trim();
}

/**
 * Build a stable short fingerprint for a SQL statement.
 */
export function createQueryFingerprint(sql: string): string {
  const normalized = normalizeQueryFingerprintSource(sql);
  return createHash('sha1').update(normalized).digest('hex').slice(0, QUERY_FINGERPRINT_LENGTH);
}
