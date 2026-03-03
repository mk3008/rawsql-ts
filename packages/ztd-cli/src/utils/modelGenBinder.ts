import { scanModelGenSql } from './modelGenScanner';

export interface BoundModelGenSql {
  boundSql: string;
  orderedParamNames: string[];
}

/**
 * Converts `:name` placeholders to indexed PostgreSQL placeholders while preserving string/comment boundaries.
 */
export function bindModelGenNamedSql(sql: string): BoundModelGenSql {
  const scan = scanModelGenSql(sql);
  if (scan.mode !== 'named') {
    throw new Error('bindModelGenNamedSql expected named SQL placeholders.');
  }

  const orderedParamNames: string[] = [];
  const slotByName = new Map<string, number>();
  let cursor = 0;
  let boundSql = '';

  for (const token of scan.namedTokens) {
    boundSql += sql.slice(cursor, token.start);
    let slot = slotByName.get(token.name);
    if (!slot) {
      orderedParamNames.push(token.name);
      slot = orderedParamNames.length;
      slotByName.set(token.name, slot);
    }
    boundSql += `$${slot}`;
    cursor = token.end;
  }

  boundSql += sql.slice(cursor);
  return { boundSql, orderedParamNames };
}
