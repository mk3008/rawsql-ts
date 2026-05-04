import { executeRows, type FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import { rowsAsDto } from '../_shared/mapping';
import type { QueryCatalog } from '../_shared/queryCatalog';

export const executeGetOrderWithDetailsEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  id: string,
) => {
  const rows = await executeRows(executor, queries.orderWithDetails, [id]);
  return rowsAsDto(rows);
};
