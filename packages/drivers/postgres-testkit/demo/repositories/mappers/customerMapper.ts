import { Customer } from '../../models/Customer';

type RawCustomerRow = Record<string, unknown>;

// Normalize nullable timestamps so downstream logic always works with Date objects.
const parseDate = (value: unknown): Date | null => {
  return value ? new Date(String(value)) : null;
};

// Convert each Postgres-style column into the shared domain model shape.
export const mapCustomerRow = (row: RawCustomerRow): Customer => {
  return {
    id: Number(row.id),
    email: String(row.email),
    displayName: String(row.display_name ?? row.displayName ?? ''),
    tier: String(row.tier ?? 'standard'),
    suspendedAt: parseDate(row.suspended_at ?? row.suspendedAt),
  };
};
