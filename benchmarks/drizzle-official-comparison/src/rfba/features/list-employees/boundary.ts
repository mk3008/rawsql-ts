import { executeRows, type FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import { rowsAsDto } from '../_shared/mapping';
import type { QueryCatalog } from '../_shared/queryCatalog';

export const executeListEmployeesEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  limit: number,
  offset: number,
) => {
  const rows = await executeRows(executor, queries.employees, [limit, offset]);
  return rowsAsDto(rows);
};
