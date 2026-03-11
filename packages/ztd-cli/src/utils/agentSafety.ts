import path from 'node:path';

const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/u;
const ENCODED_SEPARATOR_PATTERN = /%2e|%2f|%5c/i;

export function rejectControlChars(value: string, label: string): string {
  if (CONTROL_CHAR_PATTERN.test(value)) {
    throw new Error(`${label} contains control characters and was rejected.`);
  }
  return value;
}

export function rejectEncodedTraversal(value: string, label: string): string {
  if (ENCODED_SEPARATOR_PATTERN.test(value)) {
    throw new Error(`${label} contains encoded path traversal or separators and was rejected.`);
  }
  return value;
}

export function validateResourceIdentifier(value: string, label: string): string {
  const normalized = rejectEncodedTraversal(rejectControlChars(value.trim(), label), label);
  if (normalized.includes('?') || normalized.includes('#')) {
    throw new Error(`${label} must not include query or fragment characters.`);
  }
  if (normalized.includes('%')) {
    throw new Error(`${label} must not include percent-encoded segments.`);
  }
  if (!normalized) {
    throw new Error(`${label} must not be empty.`);
  }
  return normalized;
}

export function validateProjectPath(targetPath: string, label: string, rootDir: string = process.cwd()): string {
  const normalizedInput = rejectEncodedTraversal(rejectControlChars(targetPath.trim(), label), label);
  if (!normalizedInput) {
    throw new Error(`${label} must not be empty.`);
  }
  const absolute = path.resolve(rootDir, normalizedInput);
  const relative = path.relative(rootDir, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the current project root.`);
  }
  return absolute;
}
