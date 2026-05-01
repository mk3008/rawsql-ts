import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import { first, rowsAsDto } from '../_shared/mapping';
import type { QueryCatalog } from '../_shared/queryCatalog';

export const executeGetSupplierByIdEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  id: string,
) => {
  const result = await executor.execute(queries.supplierById, [id]);
  return first(rowsAsDto(result.rows));
};
