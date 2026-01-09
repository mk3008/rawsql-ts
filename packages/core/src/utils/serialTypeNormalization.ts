const SERIAL_PSEUDO_TYPE_MAP: Record<string, string> = {
  serial: 'integer',
  serial4: 'integer',
  bigserial: 'bigint',
  serial8: 'bigint',
  smallserial: 'smallint',
  serial2: 'smallint',
};

/**
 * Converts Postgres serial pseudo-type names into their real storage types so ZTD
 * cast expressions never emit non-existent types.
 *
 * @param typeName Optional type name (possibly qualified) that is trimmed before normalization.
 * @returns The normalized type name when a pseudo-type matches, the trimmed input when no match is found, or `undefined` when the argument is `undefined`.
 * @example
 * normalizeSerialPseudoType('serial') // 'integer'
 * normalizeSerialPseudoType('public.BIGSERIAL') // 'public.bigint'
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
