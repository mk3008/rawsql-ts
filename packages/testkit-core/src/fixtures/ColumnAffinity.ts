export type ColumnAffinity = 'TEXT' | 'INTEGER' | 'REAL' | 'NUMERIC' | 'BLOB';

const DEFAULT_AFFINITY: ColumnAffinity = 'TEXT';

const affinityPatterns: Array<{ pattern: RegExp; affinity: ColumnAffinity }> = [
  { pattern: /(int|serial|numeric|decimal|money)/i, affinity: 'INTEGER' },
  { pattern: /(real|double|float)/i, affinity: 'REAL' },
  { pattern: /(blob|bytea|binary|varbinary|raw)/i, affinity: 'BLOB' },
  { pattern: /(bool|boolean)/i, affinity: 'INTEGER' },
  { pattern: /(text|char|string|clob|json)/i, affinity: 'TEXT' },
];

/**
 * Guesses the SQLite affinity category from the declared type name using SQLite's affinity rules.
 */
export function guessAffinity(typeName?: string): ColumnAffinity {
  if (!typeName) {
    // Fall back to TEXT when the column lacks an explicit type hint.
    return DEFAULT_AFFINITY;
  }

  const normalized = typeName.toLowerCase().trim();

  // Try to match against the ordered heuristics; later entries act as catch-alls.
  for (const entry of affinityPatterns) {
    if (entry.pattern.test(normalized)) {
      return entry.affinity;
    }
  }

  return DEFAULT_AFFINITY;
}
