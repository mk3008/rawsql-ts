import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export type QueryDefinition = {
  readonly name: string;
  readonly file: string;
};

export type PreparedQuery = QueryDefinition & {
  readonly text: string;
};

type RawsqlParserModule = {
  SelectQueryParser: {
    parse(sql: string): unknown;
  };
};

const queryDefinitions = {
  customers: { name: 'rfba_p1_customers', file: 'customers.sql' },
  customerById: { name: 'rfba_p2_customer_by_id', file: 'customer-by-id.sql' },
  searchCustomer: { name: 'rfba_p3_search_customer', file: 'search-customer.sql' },
  employees: { name: 'rfba_p4_employees', file: 'employees.sql' },
  employeeWithRecipient: { name: 'rfba_p5_employee_with_recipient', file: 'employee-with-recipient.sql' },
  suppliers: { name: 'rfba_p6_suppliers', file: 'suppliers.sql' },
  supplierById: { name: 'rfba_p7_supplier_by_id', file: 'supplier-by-id.sql' },
  products: { name: 'rfba_p8_products', file: 'products.sql' },
  productWithSupplier: { name: 'rfba_p9_product_with_supplier', file: 'product-with-supplier.sql' },
  searchProduct: { name: 'rfba_p10_search_product', file: 'search-product.sql' },
  ordersWithDetails: { name: 'rfba_p11_orders_with_details', file: 'orders-with-details.sql' },
  orderWithDetails: { name: 'rfba_p12_order_with_details', file: 'order-with-details.sql' },
  orderWithDetailsAndProducts: {
    name: 'rfba_p13_order_with_details_and_products',
    file: 'order-with-details-and-products.sql',
  },
} as const satisfies Record<string, QueryDefinition>;

export type QueryCatalog = Record<keyof typeof queryDefinitions, PreparedQuery>;

const loadRawsqlParser = async (): Promise<RawsqlParserModule> => {
  const moduleName =
    process.env.RAWSQL_TS_IMPORT ??
    pathToFileURL(path.resolve(__dirname, '../../../../../../packages/core/src/index.ts')).href;
  return import(moduleName) as Promise<RawsqlParserModule>;
};

export const loadQueryCatalog = async (): Promise<QueryCatalog> => {
  const { SelectQueryParser } = await loadRawsqlParser();
  const sqlDir = path.resolve(__dirname, '../../../../sql');

  return Object.fromEntries(
    Object.entries(queryDefinitions).map(([key, definition]) => {
      const text = fs.readFileSync(path.join(sqlDir, definition.file), 'utf8');
      SelectQueryParser.parse(text);
      return [key, { ...definition, text }];
    }),
  ) as QueryCatalog;
};
