import { executeRows, type FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import { first, rowsAsDto } from '../_shared/mapping';
import type { QueryCatalog } from '../_shared/queryCatalog';

export const executeGetCustomerByIdEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  id: string,
) => {
  const rows = await executeRows(executor, queries.customerById, [id]);
  return first(rowsAsDto(rows));
};
