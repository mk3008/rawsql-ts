interface RepositoryQueryResult<T> {
  rows: T[];
  rowCount?: number | null;
}

/**
 * Minimal query executor that keeps repositories driver-agnostic.
 */
export interface QueryExecutor {
  query<T>(queryText: string, values?: readonly unknown[]): Promise<RepositoryQueryResult<T>>;
}

export class UserRepository {
  constructor(private readonly db: QueryExecutor) {}

  public async createUser(email: string, active: boolean): Promise<{ email: string; active: boolean }> {
    // pg-testkit rewrites this INSERT ... RETURNING into a fixture-backed SELECT result.
    const result = await this.db.query<{ email: string; active: boolean }>(
      'insert into users (email, active) values ($1, $2) returning email, active',
      [email, active]
    );
    return result.rows[0];
  }

  public async findById(id: number): Promise<{ id: number; email: string; active: boolean } | null> {
    const result = await this.db.query<{ id: number; email: string; active: boolean }>(
      'select id, email, active from users where id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }

  public async updateActive(id: number, active: boolean): Promise<number> {
    // The fixture simulation determines the row count from the matched fixtures.
    const result = await this.db.query('update users set active = $2 where id = $1', [id, active]);
    return result.rowCount ?? 0;
  }

  public async deleteById(id: number): Promise<number> {
    // DELETE statements are executed against fixtures so no physical rows change.
    const result = await this.db.query('delete from users where id = $1', [id]);
    return result.rowCount ?? 0;
  }

  public async listActive(limit: number): Promise<string[]> {
    // SELECT is scoped to fixtures, so the returned emails reflect the provided dataset.
    const result = await this.db.query<{ email: string }>(
      'select email from users where active = true order by id limit $1',
      [limit]
    );
    return result.rows.map((row: { email: string }) => row.email);
  }
}
