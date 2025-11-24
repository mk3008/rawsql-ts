/**
 * Normalizes table identifiers that may include schema qualifiers or quotes so
 * driver fixtures can match the actual SQL names Prisma emits.
 */
export const normalizeTableName = (tableName: string): string => {
  const cleaned = tableName.replace(/"/g, '').trim();
  return cleaned.toLowerCase();
};

/**
 * Returns both the original normalized name and the schema-stripped variant so
 * callers can match either qualified or unqualified references.
 */
export const tableNameVariants = (tableName: string): string[] => {
  const normalized = normalizeTableName(tableName);
  const baseName = normalized.includes('.') ? normalized.split('.').pop() ?? normalized : normalized;
  const variants = new Set<string>([normalized]);
  if (baseName && baseName !== normalized) {
    variants.add(baseName);
  }
  return [...variants];
};
