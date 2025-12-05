export const DEFAULT_EXTENSIONS = ['.sql'];
export const DEFAULT_DDL_DIRECTORY = 'ddl';
export const DEFAULT_TESTS_DIRECTORY = 'tests';
const EXTENSION_TOKEN_PATTERN = /^[A-Za-z0-9_]+$/;

export function collectDirectories(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function normalizeDirectoryList(userDirectories: string[] | undefined, fallback: string): string[] {
  const candidates = (userDirectories ?? []).map((entry) => entry.trim()).filter(Boolean);
  // Fall back to the configured default directory when no explicit paths are provided.
  const directories = candidates.length ? candidates : [fallback];
  return Array.from(new Set(directories));
}

export function parseExtensions(value: string | string[]): string[] {
  const rawEntries = Array.isArray(value) ? value : value.split(',');

  // Clean and normalize each candidate before deduplicating to ensure stable output.
  const cleanedTokens = rawEntries
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry !== '.')
    .map((entry) => (entry.startsWith('.') ? entry.slice(1) : entry))
    .filter((token) => token.length > 0 && EXTENSION_TOKEN_PATTERN.test(token))
    .map((token) => `.${token.toLowerCase()}`);

  return Array.from(new Set(cleanedTokens)).sort();
}

export function resolveExtensions(input: string[] | undefined, fallback: string[]): string[] {
  // Use user-specified extensions when present; otherwise rely on the default list.
  const normalized = input?.length ? input : fallback;
  return Array.from(new Set(normalized));
}
