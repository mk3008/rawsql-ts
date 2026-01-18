import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/** Plain SQL repository that exercises inserts, updates, and deletes via Drizzle. */
export class DrizzleUserRepository {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * INSERT ... RETURNING is rewritten to a fixture-backed SELECT so the returned
   * tuple comes entirely from pg-testkit instead of a physical write.
   */
  public async createUser(email: string, active: boolean): Promise<{ email: string; active: boolean }> {
    // Trigger the INSERT so pg-testkit can synthesize the returning row from fixtures.
    const result = await this.db.execute(
      sql<{ email: string; active: boolean }>`
        insert into users_drizzle (email, active)
        values (${email}, ${active})
        returning email, active
      `
    );
    return result.rows[0] as { email: string; active: boolean };
  }

  /**
   * UPDATE is rewritten so rowCount reflects how many fixture rows the
   * WHERE clause matches, without touching a real table.
   */
  public async updateActive(id: number, active: boolean): Promise<number> {
    // Execute the SQL so pg-testkit can compute the rowCount from the fixtures.
    const result = await this.db.execute(sql`update users_drizzle set active = ${active} where id = ${id}`);
    return result.rowCount ?? 0;
  }

  /**
   * DELETE is treated similarly: pg-testkit computes rowCount from fixtures.
   */
  public async deleteById(id: number): Promise<number> {
    // Let pg-testkit simulate the delete and report how many fixtures match.
    const result = await this.db.execute(sql`delete from users_drizzle where id = ${id}`);
    return result.rowCount ?? 0;
  }
}
