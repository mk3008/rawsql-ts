import type { Customer } from '../models/Customer';
import { createDemoConnection } from '../db/sqliteConnectionFactory';
import { mapCustomerRow, type CustomerRow } from './mappers/customerMapper';
import type { CustomerRepositoryConnection } from '../types/CustomerRepositoryConnection';

export class CustomerRepository {
  private readonly connection: CustomerRepositoryConnection;

  constructor(connection?: CustomerRepositoryConnection) {
    // Acquire a reusable SQLite connection that matches the demo .env configuration.
    this.connection = connection ?? createDemoConnection();
  }

  public findByEmail(email: string): Customer | null {
    // Favor prepared statements so SQL fixture rewrites can shadow the same text consistently.
    const statement = this.connection.prepare(
      `
      SELECT id, email, display_name, tier, suspended_at
      FROM customers
      WHERE email = @email
      LIMIT 1
    `
    );

    // Map the nullable column to a Date to better emulate production mapping layers.
    const record = statement.get({ email }) as CustomerRow | undefined;
    if (!record) {
      return null;
    }
    return mapCustomerRow(record);
  }

  public listActive(limit = 50): Customer[] {
    // Provide a deterministic ordering for predictable fixture assertions.
    const statement = this.connection.prepare(
      `
      SELECT id, email, display_name, tier, suspended_at
      FROM customers
      WHERE suspended_at IS NULL
      ORDER BY id ASC
      LIMIT @limit
    `
    );

    // Cast rows so downstream callers never see raw driver records.
    const rows = statement.all({ limit }) as CustomerRow[];
    return rows.map(mapCustomerRow);
  }

  public close(): void {
    // Allow tests to deterministically release handles between runs.
    this.connection.close();
  }
}
