import { MultiQuerySplitter } from 'rawsql-ts';
import { createQueryFingerprint } from './queryFingerprint';

/**
 * Statement inventory entry derived from a catalog SQL file.
 */
export interface CatalogStatement {
  catalogId: string;
  queryId: string;
  statementFingerprint: string;
  sqlFile: string;
  statementIndex: number;
  statementText: string;
  statementStartOffsetInFile: number;
}

/**
 * Split a catalog SQL file into deterministic statement inventory rows.
 */
export function buildCatalogStatements(params: {
  catalogId: string;
  sqlFile: string;
  sqlText: string;
}): CatalogStatement[] {
  const split = MultiQuerySplitter.split(params.sqlText);
  return split.queries
    .filter((query) => !query.isEmpty)
    .map((query, index) => ({
      catalogId: params.catalogId,
      queryId: `${params.catalogId}:${index + 1}`,
      statementFingerprint: createQueryFingerprint(query.sql),
      sqlFile: params.sqlFile,
      statementIndex: index + 1,
      statementText: query.sql,
      statementStartOffsetInFile: query.start
    }));
}
