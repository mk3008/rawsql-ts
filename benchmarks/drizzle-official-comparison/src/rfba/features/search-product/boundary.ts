import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import { rowsAsDto } from '../_shared/mapping';
import type { QueryCatalog } from '../_shared/queryCatalog';

export const executeSearchProductEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  term: string,
) => {
  const result = await executor.execute(queries.searchProduct, [term]);
  return rowsAsDto(result.rows);
};
