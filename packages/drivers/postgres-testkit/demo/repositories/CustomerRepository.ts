import type { PostgresConnectionLike } from '@rawsql-ts/postgres-testkit/src/types';
import { mapCustomerRow } from './mappers/customerMapper';
import type { Customer } from '../models/Customer';

type QueryResultRow = Record<string, unknown>;

export class CustomerRepository {
  constructor(private readonly connection: PostgresConnectionLike) {}

  public listActive(): Promise<Customer[]> {
    const sql = 'SELECT id, email, display_name, tier, suspended_at FROM public.customers WHERE suspended_at IS NULL';
    return this.connection.query(sql).then((result) => result.rows.map(mapCustomerRow));
  }

  public async findByEmail(email: string): Promise<Customer | null> {
    const sql = 'SELECT id, email, display_name, tier, suspended_at FROM public.customers WHERE email = $1 LIMIT 1';
    const result = await this.connection.query(sql, [email]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapCustomerRow(result.rows[0] as QueryResultRow);
  }

  public async close(): Promise<void> {
    await this.connection.end?.();
  }
}
