import { FullNameParser } from '../parsers/FullNameParser';

/**
 * Parses a table name through the SQL parser so all supported identifier
 * syntaxes (quoted, bracketed, backtick) converge to a consistent key.
 */
export const normalizeTableName = (tableName: string): string => {
  // Parse with the same rules as the main AST to avoid regex-based drift.
  const parsed = FullNameParser.parse(tableName);
  const namespaces = parsed.namespaces ?? [];
  const parts = [...namespaces, parsed.name.name];
  return parts.join('.').toLowerCase();
};

/**
 * For schema-sensitive matching we no longer drop qualifiers; a single
 * normalized key is sufficient and safer than heuristic variants.
 */
export const tableNameVariants = (tableName: string): string[] => {
  const parsed = FullNameParser.parse(tableName);
  const namespaces = parsed.namespaces ?? [];
  const normalized = normalizeTableName(tableName);
  // Return the parsed-normalized key alone when no schema qualifier is present.
  if (namespaces.length === 0) {
    return [normalized];
  }

  // DONOT return an unqualified variant; schema-qualified normalization is required to avoid mixing distinct tables.
  return [normalized];
};
