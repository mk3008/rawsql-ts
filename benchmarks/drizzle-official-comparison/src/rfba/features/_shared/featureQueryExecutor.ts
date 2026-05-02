import type { Row } from '../../../local/sql-contract-mapper';
import type { PreparedQuery } from './queryCatalog';

export interface FeatureQueryExecutor {
  execute(
    query: PreparedQuery,
    values?: readonly unknown[],
  ): Promise<{
    rows: Row[];
    rowCount?: number;
  }>;
}
