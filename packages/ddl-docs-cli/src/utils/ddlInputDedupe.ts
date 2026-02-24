import type { DdlInput } from '../types';

/**
 * Dedupe DDL inputs by the tuple key of (instance, path).
 *
 * Inputs sharing only the path are preserved when their instance differs.
 * The key format intentionally uses a NUL separator to avoid collisions with
 * common path characters on Windows and POSIX.
 */
export function dedupeDdlInputsByInstanceAndPath(inputs: DdlInput[]): DdlInput[] {
  const seen = new Set<string>();
  return inputs.filter((input) => {
    const normalizedInstance = input.instance ?? '';
    const normalizedPath = input.path;
    const key = `${normalizedInstance}\0${normalizedPath}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
