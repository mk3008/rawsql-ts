export const normalizeIdentifier = (value: string): string => value.toLowerCase();

/**
 * Sanitize a fixture table identifier so it can be used as a CTE name without schema separators.
 */
export const sanitizeFixtureIdentifier = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'cte';
  }

  const replacedDots = trimmed.replace(/\./g, '__');
  const normalized = replacedDots.replace(/[^0-9a-zA-Z_]+/g, '_');
  const collapsed = normalized.replace(/__+/g, '__').replace(/^_+/, '').replace(/_+$/, '');
  const base = collapsed || 'cte';

  if (/^[0-9]/.test(base)) {
    return `t_${base}`;
  }
  return base;
};
