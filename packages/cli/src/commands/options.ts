export const DEFAULT_EXTENSIONS = ['.sql'];
export const DEFAULT_DDL_DIRECTORY = 'ddl';
const EXTENSION_TOKEN_PATTERN = /^[A-Za-z0-9_]+$/;

export function collectDirectories(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function parseExtensions(value: string | string[]): string[] {
  const rawEntries = Array.isArray(value) ? value : value.split(',');

  // Normalize each extension candidate before deduplicating.
  const cleanedTokens = rawEntries
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry !== '.')
    .map((entry) => (entry.startsWith('.') ? entry.slice(1) : entry))
    .filter((token) => token.length > 0 && EXTENSION_TOKEN_PATTERN.test(token))
    .map((token) => `.${token.toLowerCase()}`);

  // Deduplicate and sort so callers observe deterministic extension ordering.
  return Array.from(new Set(cleanedTokens)).sort();
}
