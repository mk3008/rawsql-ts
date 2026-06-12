import { executeRows, type FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import { first, rowsAsDto } from '../_shared/mapping';
import type { QueryCatalog } from '../_shared/queryCatalog';

export const executeGetSupplierByIdEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  id: string,
) => {
  const rows = await executeRows(executor, queries.supplierById, [id]);
  return first(rowsAsDto(rows));
};
