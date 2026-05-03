import { executeRows, type FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import { rowsAsDto } from '../_shared/mapping';
import type { QueryCatalog } from '../_shared/queryCatalog';

export const executeSearchCustomerEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  term: string,
) => {
  const rows = await executeRows(executor, queries.searchCustomer, [`${term}:*`]);
  return rowsAsDto(rows);
};
