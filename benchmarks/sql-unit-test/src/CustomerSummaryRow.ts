import type { QueryResultRow } from 'pg';

/** The DTO that the customer summary repository returns. */
export interface CustomerSummaryRow extends QueryResultRow {
  customer_id: number;
  customer_name: string;
  customer_email: string;
  total_orders: number;
  total_amount: number;
  last_order_date: string | null;
}
