import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import { rowsAsDto } from '../_shared/mapping';
import type { QueryCatalog } from '../_shared/queryCatalog';

export const executeListOrdersWithDetailsEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  limit: number,
  offset: number,
) => {
  const result = await executor.execute(queries.ordersWithDetails, [limit, offset]);
  return rowsAsDto(result.rows);
};
