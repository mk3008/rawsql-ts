import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { executeQueryPipeline } from '../src/query/execute';
import { buildQueryPipelinePlan } from '../src/query/planner';
import {
  TAX_ALLOCATION_CASES,
  TAX_ALLOCATION_FIXTURE_ROWS,
  TAX_ALLOCATION_METADATA,
  TAX_ALLOCATION_QUERY,
} from './utils/taxAllocationScenario';

const containerRuntimeAvailable = (() => {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
})();

const ztdDescribe = containerRuntimeAvailable ? describe : describe.skip;
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function normalizeRows(rows: Array<Record<string, unknown>>): Array<{ id: number; amount_cents: number; allocated_tax_cents: number }> {
  return rows.map((row) => ({
    id: Number(row.id),
    amount_cents: Number(row.amount_cents),
    allocated_tax_cents: Number(row.allocated_tax_cents),
  }));
}

ztdDescribe('tax allocation dogfood scenario', () => {
  let container: StartedPostgreSqlContainer | null = null;
  let sqlFile = '';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();
    const workspace = createTempDir('tax-allocation-dogfood');
    sqlFile = path.join(workspace, 'src', 'sql', 'tax_allocation.sql');
    mkdirSync(path.dirname(sqlFile), { recursive: true });
    writeFileSync(sqlFile, TAX_ALLOCATION_QUERY, 'utf8');

    const client = await createConnectedClient(container);
    try {
      await client.query(`
        create table public.invoice_lines (
          invoice_id integer not null,
          id integer primary key,
          amount_cents integer not null,
          tax_rate_basis_points integer not null
        )
      `);

      for (const row of TAX_ALLOCATION_FIXTURE_ROWS) {
        await client.query(
          `insert into public.invoice_lines (invoice_id, id, amount_cents, tax_rate_basis_points) values ($1, $2, $3, $4)`,
          [row.invoice_id, row.id, row.amount_cents, row.tax_rate_basis_points]
        );
      }
    } finally {
      await client.end();
    }
  }, 120000);

  afterAll(async () => {
    if (container) {
      await container.stop();
    }
  });

  test.each(TAX_ALLOCATION_CASES)('pipeline preserves tax allocation result: $label', async ({ invoiceId, expectedRows }) => {
    const directRows = await runDirectAllocation(invoiceId, sqlFile, container);
    const pipelineResult = await runPipelineAllocation(invoiceId, sqlFile, container);

    expect(directRows).toEqual(expectedRows);
    expect(pipelineResult.finalRows).toEqual(expectedRows);
    expect(pipelineResult.openSessionCount).toBe(1);
    expect(pipelineResult.steps.map((step) => step.kind)).toEqual([
      'materialize',
      'materialize',
      'materialize',
      'scalar-filter-bind',
      'final-query',
    ]);
  }, 120000);

  test('tax allocation dogfood picks natural split points and rewrites the remainder filter', async () => {
    const plan = buildQueryPipelinePlan(sqlFile, TAX_ALLOCATION_METADATA);
    expect(plan.steps).toEqual([
      { step: 1, kind: 'materialize', target: 'input_lines', depends_on: [] },
      { step: 2, kind: 'materialize', target: 'floored_allocations', depends_on: ['raw_tax_basis'] },
      { step: 3, kind: 'materialize', target: 'ranked_allocations', depends_on: ['floored_allocations'] },
      { step: 4, kind: 'final-query', target: 'FINAL_QUERY', depends_on: ['final_allocations'] },
    ]);

    const pipelineResult = await runPipelineAllocation(2, sqlFile, container);
    const finalSql = normalizeSql(
      [...pipelineResult.history].reverse().find((entry) => !entry.sql.startsWith('drop table if exists'))?.sql ?? ''
    );
    const flooredStageSql = normalizeSql(pipelineResult.history.find((entry) => entry.sql.includes('from "input_lines"'))?.sql ?? '');
    const rankedStageSql = normalizeSql(pipelineResult.history.find((entry) => entry.sql.includes('from "floored_allocations"'))?.sql ?? '');

    expect(flooredStageSql).toContain('from "input_lines"');
    expect(rankedStageSql).toContain('from "floored_allocations"');
    expect(finalSql).toContain('from "ranked_allocations" as "ranked"');
    expect(finalSql).toMatch(/where "allocation_rank" <= \$1/);
    expect(finalSql).not.toContain('from "floored_allocations"');
    expect(finalSql).not.toContain('from "input_lines"');
  }, 120000);
});

async function runDirectAllocation(
  invoiceId: number,
  sqlFile: string,
  container: StartedPostgreSqlContainer | null
): Promise<Array<{ id: number; amount_cents: number; allocated_tax_cents: number }>> {
  const client = await createConnectedClient(container);
  try {
    const sql = TAX_ALLOCATION_QUERY.trimEnd();
    const result = await client.query(sql, [invoiceId]);
    return normalizeRows(result.rows as Array<Record<string, unknown>>);
  } finally {
    await client.end();
  }
}

async function runPipelineAllocation(
  invoiceId: number,
  sqlFile: string,
  container: StartedPostgreSqlContainer | null
): Promise<{
  finalRows: Array<{ id: number; amount_cents: number; allocated_tax_cents: number }>;
  openSessionCount: number;
  steps: Awaited<ReturnType<typeof executeQueryPipeline>>['steps'];
  history: Array<{ sql: string; params?: unknown[] | Record<string, unknown> }>;
}> {
  const history: Array<{ sql: string; params?: unknown[] | Record<string, unknown> }> = [];
  let openSessionCount = 0;

  const result = await executeQueryPipeline(
    {
      openSession: async () => {
        openSessionCount += 1;
        const client = await createConnectedClient(container);
        return {
          query: async (sql: string, params?: unknown[] | Record<string, unknown>) => {
            history.push({ sql, params });
            const result = await client.query(sql, params as unknown[] | undefined);
            return {
              rows: result.rows as Array<Record<string, unknown>>,
              rowCount: result.rowCount,
            };
          },
          end: async () => {
            await client.end();
          },
        };
      },
    },
    {
      sqlFile,
      metadata: TAX_ALLOCATION_METADATA,
      params: [invoiceId],
    }
  );

  return {
    finalRows: normalizeRows(result.final.rows),
    openSessionCount,
    steps: result.steps,
    history,
  };
}

async function createConnectedClient(container: StartedPostgreSqlContainer | null): Promise<Client> {
  if (!container) {
    throw new Error('Postgres container is not initialized for tax allocation dogfood tests.');
  }

  const client = new Client({ connectionString: container.getConnectionUri() });
  await client.connect();
  return client;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

