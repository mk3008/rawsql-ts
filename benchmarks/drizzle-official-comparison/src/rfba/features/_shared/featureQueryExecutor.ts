import type { Row } from '../../../local/sql-contract-mapper';
import type { PreparedQuery } from './queryCatalog';

export interface FeatureQueryExecutor {
  executeRows?(query: PreparedQuery, values?: readonly unknown[]): Promise<Row[]>;

  execute(
    query: PreparedQuery,
    values?: readonly unknown[],
  ): Promise<{
    rows: Row[];
    rowCount?: number;
  }>;
}

export const executeRows = async (
  executor: FeatureQueryExecutor,
  query: PreparedQuery,
  values?: readonly unknown[],
): Promise<Row[]> => {
  if (executor.executeRows) {
    return executor.executeRows(query, values);
  }

  const result = await executor.execute(query, values);
  return result.rows;
};
