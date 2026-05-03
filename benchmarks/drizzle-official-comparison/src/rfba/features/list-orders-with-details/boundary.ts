import { executeRows, type FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import { rowsAsDto } from '../_shared/mapping';
import type { QueryCatalog } from '../_shared/queryCatalog';

export const executeListOrdersWithDetailsEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  limit: number,
  offset: number,
) => {
  const rows = await executeRows(executor, queries.ordersWithDetails, [limit, offset]);
  return rowsAsDto(rows);
};
