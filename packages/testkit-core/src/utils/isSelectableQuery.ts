import { SelectQuery, SqlParser } from 'rawsql-ts';

const isSelectStatement = (statement: unknown): statement is SelectQuery => {
  if (typeof statement !== 'object' || statement === null) {
    return false;
  }

  // The discriminator property is set on all select AST nodes.
  return '__selectQueryType' in statement && (statement as SelectQuery).__selectQueryType === 'SelectQuery';
};

export const isSelectableQuery = (sql: string): boolean => {
  const trimmed = sql.trimStart();
  if (trimmed.length === 0) {
    return false;
  }

  try {
    // Parse the statement with the canonical SQL parser so we know the actual statement type.
    const parsed = SqlParser.parse(trimmed, { mode: 'single' });
    return isSelectStatement(parsed);
  } catch {
    return false;
  }
};
