import { executeRows, type FeatureQueryExecutor } from '../_shared/featureQueryExecutor';
import type { QueryCatalog } from '../_shared/queryCatalog';
import { mapOrderWithDetailsAndProductsRowsToResult } from './generated/row-mapper';

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
};

export type OrderDetailDto = {
  unitPrice: number;
  quantity: number;
  discount: number;
  orderId: number;
  productId: number;
  product: ProductDto;
};

export type OrderWithDetailsDto = {
  id: number;
  orderDate: string;
  requiredDate: string;
  shippedDate: string | null;
  shipVia: number;
  freight: number;
  shipName: string;
  shipCity: string;
  shipRegion: string | null;
  shipPostalCode: string | null;
  shipCountry: string;
  customerId: number;
  employeeId: number;
  details: OrderDetailDto[];
};

export const executeGetOrderWithDetailsAndProductsEntrySpec = async (
  executor: FeatureQueryExecutor,
  queries: QueryCatalog,
  id: string,
): Promise<OrderWithDetailsDto[]> => {
  const rows = await executeRows(executor, queries.orderWithDetailsAndProducts, [id]);
  return mapOrderWithDetailsAndProductsRowsToResult(rows);
};
