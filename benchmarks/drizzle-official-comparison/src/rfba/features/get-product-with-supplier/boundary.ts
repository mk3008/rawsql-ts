import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import type { QueryCatalog } from '../_shared/queryCatalog';
import { mapProductWithSupplierRowsToResult } from './generated/row-mapper';

export type SupplierDto = {
  id: number;
  companyName: string;
  contactName: string;
  contactTitle: string;
  address: string;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string;
};

export type ProductDto = {
  id: number;
  name: string;
  quantityPerUnit: string;
  unitPrice: number;
  unitsInStock: number;
  unitsOnOrder: number;
  reorderLevel: number;
  discontinued: number;
  supplierId: number;
  supplier?: SupplierDto;
};

export const executeGetProductWithSupplierEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  id: string,
): Promise<ProductDto[]> => {
  const result = await executor.execute(queries.productWithSupplier, [id]);
  return mapProductWithSupplierRowsToResult(result.rows);
};
