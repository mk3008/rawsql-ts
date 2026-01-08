const SERIAL_PSEUDO_TYPE_MAP: Record<string, string> = {
  serial: 'integer',
  serial4: 'integer',
  bigserial: 'bigint',
  serial8: 'bigint',
  smallserial: 'smallint',
  serial2: 'smallint',
};

/**
 * Converts Postgres serial pseudo-type names into real storage types
 * so ZTD cast expressions never emit non-existent types.
 */
export function normalizeSerialPseudoType(typeName?: string): string | undefined {
  if (!typeName) {
    return typeName;
  }

  const trimmed = typeName.trim();
  if (!trimmed) {
    return trimmed;
  }

  // Preserve schema or catalog qualifiers while normalizing the terminal segment.
  const segments = trimmed.split('.');
  const base = segments.pop()!;
  const normalizedBase = SERIAL_PSEUDO_TYPE_MAP[base.toLowerCase()];

  if (!normalizedBase) {
    return trimmed;
  }

  segments.push(normalizedBase);
  return segments.join('.');
}
