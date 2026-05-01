import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import {
  compileColumnProjector,
  mapRows,
  rowMapping,
  type Row,
} from '../src/local/sql-contract-mapper';
import { mapOrderWithDetailsAndProductsRowsToResult } from '../src/rfba/features/get-order-with-details-and-products/generated/row-mapper';
import { mapProductWithSupplierRowsToResult } from '../src/rfba/features/get-product-with-supplier/generated/row-mapper';

type ProfileResult = {
  name: string;
  iterations: number;
  elapsedMs: number;
  opsPerSec: number;
  checksum: number;
};

type SupplierDto = {
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

type ProductDto = {
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

type OrderDetailDto = {
  unitPrice: number;
  quantity: number;
  discount: number;
  orderId: number;
  productId: number;
  product: ProductDto;
};

type OrderWithDetailsDto = {
  id: number;
  orderDate: string;
  requiredDate: string;
  shippedDate: string;
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

const supplierColumns = {
  id: 'supplier_id',
  companyName: 'supplier_companyName',
  contactName: 'supplier_contactName',
  contactTitle: 'supplier_contactTitle',
  address: 'supplier_address',
  city: 'supplier_city',
  region: 'supplier_region',
  postalCode: 'supplier_postalCode',
  country: 'supplier_country',
  phone: 'supplier_phone',
} as const;

const productColumns = {
  id: 'id',
  name: 'name',
  quantityPerUnit: 'quantityPerUnit',
  unitPrice: 'unitPrice',
  unitsInStock: 'unitsInStock',
  unitsOnOrder: 'unitsOnOrder',
  reorderLevel: 'reorderLevel',
  discontinued: 'discontinued',
  supplierId: 'supplierId',
} as const;

const orderColumns = {
  id: 'id',
  orderDate: 'orderDate',
  requiredDate: 'requiredDate',
  shippedDate: 'shippedDate',
  shipVia: 'shipVia',
  freight: 'freight',
  shipName: 'shipName',
  shipCity: 'shipCity',
  shipRegion: 'shipRegion',
  shipPostalCode: 'shipPostalCode',
  shipCountry: 'shipCountry',
  customerId: 'customerId',
  employeeId: 'employeeId',
} as const;

const orderProductColumns = {
  id: 'product_id',
  name: 'product_name',
  quantityPerUnit: 'product_quantityPerUnit',
  unitPrice: 'product_unitPrice',
  unitsInStock: 'product_unitsInStock',
  unitsOnOrder: 'product_unitsOnOrder',
  reorderLevel: 'product_reorderLevel',
  discontinued: 'product_discontinued',
  supplierId: 'product_supplierId',
} as const;

const detailColumns = {
  unitPrice: 'detail_unitPrice',
  quantity: 'detail_quantity',
  discount: 'detail_discount',
  orderId: 'detail_orderId',
  productId: 'detail_productId',
} as const;

const supplierMapping = rowMapping<SupplierDto, 'id'>({
  name: 'ProfileSupplier',
  key: 'id',
  columnMap: supplierColumns,
  coerce: false,
});

const productWithSupplierMapping = rowMapping<ProductDto, 'id'>({
  name: 'ProfileProduct',
  key: 'id',
  columnMap: productColumns,
  coerce: false,
}).belongsTo('supplier', supplierMapping, 'supplierId');

const orderMapping = rowMapping<Omit<OrderWithDetailsDto, 'details'>, 'id'>({
  name: 'ProfileOrder',
  key: 'id',
  columnMap: orderColumns,
  coerce: false,
});

const orderProductMapping = rowMapping<ProductDto, 'id'>({
  name: 'ProfileOrderProduct',
  key: 'id',
  columnMap: orderProductColumns,
  coerce: false,
});

const detailMapping = rowMapping<OrderDetailDto>({
  name: 'ProfileOrderDetail',
  key: ['detail_orderId', 'detail_productId'],
  columnMap: detailColumns,
  coerce: false,
}).belongsTo('product', orderProductMapping, 'productId');

const projectSupplier = compileColumnProjector<SupplierDto>(supplierColumns, { coerce: false });
const projectProduct = compileColumnProjector<ProductDto>(productColumns, { coerce: false });
const projectOrder = compileColumnProjector<Omit<OrderWithDetailsDto, 'details'>>(orderColumns, { coerce: false });
const projectOrderProduct = compileColumnProjector<ProductDto>(orderProductColumns, { coerce: false });
const projectDetail = compileColumnProjector<Omit<OrderDetailDto, 'product'>>(detailColumns, { coerce: false });

const productRows: Row[] = [{
  id: 1,
  name: 'Dare and Sons',
  quantityPerUnit: '32 - 8 oz bottles',
  unitPrice: 111,
  unitsInStock: 4,
  unitsOnOrder: 50,
  reorderLevel: 10,
  discontinued: 0,
  supplierId: 10,
  supplier_id: 10,
  supplier_companyName: 'Ward, Hermiston and Homenick',
  supplier_contactName: 'Dr. Julie Dibbert',
  supplier_contactTitle: 'Human Factors Architect',
  supplier_address: '763 Gulgowski Cliffs',
  supplier_city: 'Enid',
  supplier_region: 'North Carolina',
  supplier_postalCode: '03384-7369',
  supplier_country: 'South Africa',
  supplier_phone: '(250) 542-7176',
}];

const orderRows: Row[] = Array.from({ length: 4 }, (_, index) => ({
  id: 1,
  orderDate: '2016-01-04T00:00:00Z',
  requiredDate: '2016-01-31T00:00:00Z',
  shippedDate: '2016-01-11T00:00:00Z',
  shipVia: 3,
  freight: 151.47,
  shipName: '779 Connelly Square',
  shipCity: 'New Conorboro',
  shipRegion: 'Washington',
  shipPostalCode: '31499-6625',
  shipCountry: 'Marshall Islands',
  customerId: 4746,
  employeeId: 78,
  detail_unitPrice: 100 + index,
  detail_quantity: 10 + index,
  detail_discount: 0.15,
  detail_orderId: 1,
  detail_productId: 300 + index,
  product_id: 300 + index,
  product_name: `Product ${index}`,
  product_quantityPerUnit: '12 - 100 g pkgs',
  product_unitPrice: 100 + index,
  product_unitsInStock: 14,
  product_unitsOnOrder: 60,
  product_reorderLevel: 10,
  product_discontinued: 1,
  product_supplierId: 757,
}));

const mapProductGeneric = (rows: Row[]): ProductDto[] => mapRows(rows, productWithSupplierMapping);
const mapProductCompiled = (rows: Row[]): ProductDto[] => {
  const mapped = new Array<ProductDto>(rows.length);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const product = projectProduct(row);
    product.supplier = projectSupplier(row);
    mapped[index] = product;
  }
  return mapped;
};

const mapOrderGeneric = (rows: Row[]): OrderWithDetailsDto[] => {
  const orders = mapRows(rows, orderMapping);
  if (orders.length === 0) {
    return [];
  }
  const details = mapRows(rows, detailMapping);
  return [{ ...orders[0], details }];
};

const mapOrderCompiled = (rows: Row[]): OrderWithDetailsDto[] => {
  const first = rows[0];
  if (!first) {
    return [];
  }
  const details: OrderDetailDto[] = [];
  for (const row of rows) {
    details.push({
      ...projectDetail(row),
      product: projectOrderProduct(row),
    });
  }
  return [{ ...projectOrder(first), details }];
};

const bench = (
  name: string,
  iterations: number,
  run: () => unknown[]
): ProfileResult => {
  let checksum = 0;
  for (let index = 0; index < 10_000; index += 1) {
    checksum += run().length;
  }

  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    checksum += run().length;
  }
  const elapsedMs = performance.now() - start;
  return {
    name,
    iterations,
    elapsedMs,
    opsPerSec: iterations / (elapsedMs / 1000),
    checksum,
  };
};

const iterations = Number(process.env.MAPPER_PROFILE_ITERATIONS ?? 250_000);
const results = [
  bench('product-with-supplier generic mapRows', iterations, () => mapProductGeneric(productRows)),
  bench('product-with-supplier compiled projector', iterations, () => mapProductCompiled(productRows)),
  bench('product-with-supplier generated mapper', iterations, () => mapProductWithSupplierRowsToResult(productRows)),
  bench('order-with-details-and-products generic mapRows', iterations, () => mapOrderGeneric(orderRows)),
  bench('order-with-details-and-products compiled projector', iterations, () => mapOrderCompiled(orderRows)),
  bench('order-with-details-and-products generated mapper', iterations, () => mapOrderWithDetailsAndProductsRowsToResult(orderRows)),
];

const byName = Object.fromEntries(results.map((result) => [result.name, result]));
const summary = {
  iterations,
  results,
  ratios: {
    productCompiledVsGeneric:
      byName['product-with-supplier compiled projector'].opsPerSec /
      byName['product-with-supplier generic mapRows'].opsPerSec,
    productGeneratedVsGeneric:
      byName['product-with-supplier generated mapper'].opsPerSec /
      byName['product-with-supplier generic mapRows'].opsPerSec,
    productGeneratedVsCompiled:
      byName['product-with-supplier generated mapper'].opsPerSec /
      byName['product-with-supplier compiled projector'].opsPerSec,
    orderCompiledVsGeneric:
      byName['order-with-details-and-products compiled projector'].opsPerSec /
      byName['order-with-details-and-products generic mapRows'].opsPerSec,
    orderGeneratedVsGeneric:
      byName['order-with-details-and-products generated mapper'].opsPerSec /
      byName['order-with-details-and-products generic mapRows'].opsPerSec,
    orderGeneratedVsCompiled:
      byName['order-with-details-and-products generated mapper'].opsPerSec /
      byName['order-with-details-and-products compiled projector'].opsPerSec,
  },
};

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync(
  path.join('results', 'mapper-profile-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`
);
console.log(JSON.stringify(summary, null, 2));
