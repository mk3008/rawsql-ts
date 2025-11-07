import type { Customer } from "../../models/Customer";

export interface CustomerRow {
  id: number;
  email: string;
  display_name: string;
  tier: string;
  suspended_at: string | null;
}

export const mapCustomerRow = (row: CustomerRow): Customer => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  tier: row.tier as Customer['tier'],
  suspendedAt: row.suspended_at ? new Date(row.suspended_at) : null,
});
