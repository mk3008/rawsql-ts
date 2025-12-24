import assert from 'node:assert';
import type { QueryResultRow } from 'pg';
import { customerSummarySql } from '../../sql/customer_summary';
import { productRankingSql } from '../../sql/product_ranking';
import { salesSummarySql } from '../../sql/sales_summary';

export type BenchmarkClient = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<T[]>;
};

export interface CustomerSummaryRow {
  customer_id: number;
  customer_name: string;
  customer_email: string;
  total_orders: number;
  total_amount: number;
  last_order_date: string | null;
}

export interface ProductRankingRow {
  product_id: number;
  product_name: string;
  total_revenue: number;
}

export interface SalesSummaryRow {
  year_month: string;
  total_revenue: number;
}

export class BenchmarkRepository {
  constructor(private readonly client: BenchmarkClient) {}

  customerSummary(): Promise<CustomerSummaryRow[]> {
    return this.client.query<CustomerSummaryRow>(customerSummarySql);
  }

  productRanking(): Promise<ProductRankingRow[]> {
    return this.client.query<ProductRankingRow>(productRankingSql);
  }

  salesSummary(): Promise<SalesSummaryRow[]> {
    return this.client.query<SalesSummaryRow>(salesSummarySql);
  }
}

export type BenchCaseName = 'customer-summary' | 'product-ranking' | 'sales-summary';

export const expectedCustomerSummaryRows: CustomerSummaryRow[] = [
  {
    customer_id: 1,
    customer_name: 'Alice',
    customer_email: 'alice@example.com',
    total_orders: 2,
    total_amount: 125,
    last_order_date: '2025-12-06',
  },
  {
    customer_id: 2,
    customer_name: 'Bob',
    customer_email: 'bob@example.com',
    total_orders: 1,
    total_amount: 15,
    last_order_date: '2025-12-05',
  },
  {
    customer_id: 3,
    customer_name: 'Cara',
    customer_email: 'cara@example.com',
    total_orders: 0,
    total_amount: 0,
    last_order_date: null,
  },
];

export const expectedProductRankingRows: ProductRankingRow[] = [
  {
    product_id: 11,
    product_name: 'Gadget',
    total_revenue: 75,
  },
  {
    product_id: 10,
    product_name: 'Widget',
    total_revenue: 50,
  },
  {
    product_id: 12,
    product_name: 'Accessory',
    total_revenue: 15,
  },
];

export const expectedSalesSummaryRows: SalesSummaryRow[] = [
  {
    year_month: '2025-12',
    total_revenue: 140,
  },
];

export const expectedRowsByCase: Record<BenchCaseName, CustomerSummaryRow[] | ProductRankingRow[] | SalesSummaryRow[]> =
  {
    'customer-summary': expectedCustomerSummaryRows,
    'product-ranking': expectedProductRankingRows,
    'sales-summary': expectedSalesSummaryRows,
  };

export function assertExpectedRows(
  caseName: BenchCaseName,
  actual: CustomerSummaryRow[] | ProductRankingRow[] | SalesSummaryRow[],
): void {
  assert.deepStrictEqual(actual, expectedRowsByCase[caseName]);
}
