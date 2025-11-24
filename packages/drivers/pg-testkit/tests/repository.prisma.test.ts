import { Client, ClientBase } from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createPgTestkitClient } from '../src';
import type { PgFixture } from '../src';

declare module 'vitest' {
  interface ProvidedContext {
    TEST_PG_URI: string;
  }
}

const userFixture: PgFixture = {
  tableName: 'users_prisma',
  columns: [
    { name: 'id', typeName: 'int', required: true, defaultValue: "nextval('users_prisma_id_seq'::regclass)" },
    { name: 'email', typeName: 'text', required: true },
    { name: 'active', typeName: 'bool', defaultValue: 'true' },
  ],
  rows: [
    { id: 1, email: 'alice@example.com', active: true },
    { id: 2, email: 'bob@example.com', active: false },
  ],
};

type UserRow = { id: number; email: string; active: boolean };

// Minimal Prisma-like client that routes CRUD calls to pg-testkit via raw SQL.
class FakePrismaClient {
  constructor(private readonly db: ClientBase) {}

  public user = {
    create: async ({ data }: { data: { email: string; active: boolean } }): Promise<UserRow> => {
      const res = await this.db.query<UserRow>(
        'insert into users_prisma (email, active) values ($1, $2) returning id, email, active',
        [data.email, data.active]
      );
      return res.rows[0];
    },
    update: async ({ where, data }: { where: { id: number }; data: { active: boolean } }): Promise<UserRow | null> => {
      const res = await this.db.query<UserRow>(
        'update users_prisma set active = $2 where id = $1 returning id, email, active',
        [where.id, data.active]
      );
      return res.rows[0] ?? null;
    },
    delete: async ({ where }: { where: { id: number } }): Promise<UserRow | null> => {
      const res = await this.db.query<UserRow>('delete from users_prisma where id = $1 returning id, email, active', [
        where.id,
      ]);
      return res.rows[0] ?? null;
    },
    findUnique: async ({ where }: { where: { id: number } }): Promise<UserRow | null> => {
      const res = await this.db.query<UserRow>('select id, email, active from users_prisma where id = $1', [where.id]);
      return res.rows[0] ?? null;
    },
    findMany: async ({ where, take }: { where?: { active?: boolean }; take?: number } = {}): Promise<UserRow[]> => {
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (where?.active !== undefined) {
        params.push(where.active);
        clauses.push(`active = $${params.length}`);
      }
      let sql = 'select id, email, active from users_prisma';
      if (clauses.length > 0) {
        sql += ` where ${clauses.join(' and ')}`;
      }
      if (take) {
        params.push(take);
        sql += ` limit $${params.length}`;
      }
      const res = await this.db.query<UserRow>(sql, params);
      return res.rows;
    },
  };
}

class PrismaUserRepository {
  constructor(private readonly prisma: FakePrismaClient) {}

  public async createUser(email: string, active: boolean): Promise<{ email: string; active: boolean }> {
    const created = await this.prisma.user.create({ data: { email, active } });
    return { email: created.email, active: created.active };
  }

  public async updateActive(id: number, active: boolean): Promise<number> {
    const updated = await this.prisma.user.update({ where: { id }, data: { active } });
    return updated ? 1 : 0;
  }

  public async deleteById(id: number): Promise<number> {
    const deleted = await this.prisma.user.delete({ where: { id } });
    return deleted ? 1 : 0;
  }
}

describe('UserRepository with Prisma-like client + pg-testkit', () => {
  let client: Client | undefined;
  let driver: ReturnType<typeof createPgTestkitClient> | undefined;
  let prisma: FakePrismaClient | undefined;

  beforeAll(async () => {
    const pgUri = inject('TEST_PG_URI') ?? process.env.TEST_PG_URI;
    if (!pgUri) {
      throw new Error('TEST_PG_URI is missing; ensure the Vitest global setup provided a connection.');
    }

    client = new Client({ connectionString: pgUri });
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users_prisma (
        id serial PRIMARY KEY,
        email text NOT NULL,
        active bool NOT NULL DEFAULT true
      );
    `);
    await client.query('TRUNCATE TABLE users_prisma RESTART IDENTITY;');

    driver = createPgTestkitClient({
      connectionFactory: () => client!,
      fixtures: [userFixture],
    });

    prisma = new FakePrismaClient(driver as unknown as ClientBase);
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('propagates RETURNING row on insert', async () => {
    const repo = new PrismaUserRepository(prisma!);
    const created = await repo.createUser('carol@example.com', true);
    expect(created).toEqual({ email: 'carol@example.com', active: true });
  });

  it('returns row count for updates', async () => {
    const repo = new PrismaUserRepository(prisma!);
    const updated = await repo.updateActive(2, true);
    expect(updated).toBe(1);

    const updatedMissing = await repo.updateActive(99, true);
    expect(updatedMissing).toBe(0);
  });

  it('returns row count for deletes', async () => {
    const repo = new PrismaUserRepository(prisma!);
    const deleted = await repo.deleteById(2);
    expect(deleted).toBe(1);

    const deletedMissing = await repo.deleteById(99);
    expect(deletedMissing).toBe(0);
  });
});
