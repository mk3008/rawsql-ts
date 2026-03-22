import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, vi } from 'vitest';
import * as pgDumpUtil from '../src/utils/pgDump';
import { runDiffSchema } from '../src/commands/diff';
import { analyzeMigrationPlanRisks, analyzeMigrationSqlRisks } from '../src/commands/ddlRiskEvaluator';

const repoRoot = path.resolve(__dirname, '../../..');
const tempRoot = path.join(repoRoot, 'tmp');

function readNormalizedFile(filePath: string): string {
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function createTempDir(prefix: string): string {
  if (!existsSync(tempRoot)) {
    mkdirSync(tempRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tempRoot, `${prefix}-`));
}

test('diff schema writes pure SQL plus companion review artifacts', () => {
  const ddlDir = path.join(createTempDir('cli-diff'), 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY,
        email text NOT NULL,
        last_login_at timestamptz
      );
    `,
    'utf8'
  );

  const outputFile = path.join(createTempDir('cli-diff-output'), 'users.diff.sql');
  const remoteSql = `
    CREATE TABLE public.users (
      id serial PRIMARY KEY,
      email text NOT NULL
    );
  `;

  // Replace pg_dump with a stable payload so the generated diff stays deterministic.
  const spy = vi.spyOn(pgDumpUtil, 'runPgDump').mockReturnValue(remoteSql);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));
  try {
    const result = runDiffSchema({
      directories: [ddlDir],
      extensions: ['.sql'],
      url: 'postgres://test:secret@cli-host:5432/diff-db',
      out: outputFile,
      connectionContext: {
        source: 'flags',
        host: 'cli-host',
        port: 5432,
        user: 'diff-user',
        database: 'diff-db'
      }
    });

    expect(spy).toHaveBeenCalled();
    expect(result.outFile).toBe(outputFile);
    expect(result.hasChanges).toBe(true);
    expect(result.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schema: 'public',
          table: 'users',
          changeKind: 'add_column',
          details: expect.objectContaining({
            column: 'last_login_at',
            type: 'timestamptz',
            nullable: true
          })
        })
      ])
    );
    expect(result.applyPlan.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'drop_table_cascade',
          target: 'public.users'
        }),
        expect.objectContaining({
          kind: 'recreate_table',
          target: 'public.users'
        })
      ])
    );
    expect(result.risks.destructiveRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'drop_table',
          target: 'public.users',
          avoidable: true,
          guidance: expect.arrayContaining(['review_if_required', 'cli_option_not_exposed'])
        }),
        expect.objectContaining({
          kind: 'cascade_drop',
          target: 'public.users'
        })
      ])
    );
    expect(result.risks.operationalRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'table_rebuild',
          target: 'public.users'
        }),
        expect.objectContaining({
          kind: 'full_table_copy',
          target: 'public.users'
        })
      ])
    );
  } finally {
    vi.useRealTimers();
    spy.mockRestore();
  }

  const sqlContents = readNormalizedFile(outputFile);
  const textContents = readNormalizedFile(outputFile.replace(/\.sql$/, '.txt'));
  const jsonContents = JSON.parse(readNormalizedFile(outputFile.replace(/\.sql$/, '.json')));

  expect(sqlContents).toContain('DROP TABLE IF EXISTS "public"."users" CASCADE;');
  expect(sqlContents).toContain('CREATE TABLE public.users');
  expect(sqlContents).not.toContain('-- ztd ddl diff plan');
  expect(sqlContents).not.toContain('--- local');

  expect(textContents).toContain('Migration summary');
  expect(textContents).toContain('public.users: add column last_login_at timestamptz null');
  expect(textContents).toContain('Destructive risks');
  expect(textContents).toContain('drop_table: public.users');
  expect(textContents).toContain('guidance: review_if_required, avoid_if_possible, cli_option_not_exposed');
  expect(textContents).toContain('Operational risks');
  expect(textContents).toContain('table_rebuild: public.users');
  expect(textContents).toContain(outputFile);

  expect(jsonContents).toMatchObject({
    kind: 'ddl-diff',
    hasChanges: true,
    artifacts: {
      sql: outputFile
    },
    risks: {
      destructiveRisks: expect.arrayContaining([
        expect.objectContaining({
          kind: 'drop_table',
          target: 'public.users'
        })
      ]),
      operationalRisks: expect.arrayContaining([
        expect.objectContaining({
          kind: 'table_rebuild',
          target: 'public.users'
        })
      ])
    },
    summary: expect.arrayContaining([
      expect.objectContaining({
        schema: 'public',
        table: 'users',
        changeKind: 'add_column'
      })
    ])
  });
});

test('diff schema dry-run returns review data without writing artifacts', () => {
  const ddlDir = path.join(createTempDir('cli-diff-dry-run'), 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY
      );
    `,
    'utf8'
  );

  const outputFile = path.join(createTempDir('cli-diff-dry-run-output'), 'users.diff.sql');
  const spy = vi.spyOn(pgDumpUtil, 'runPgDump').mockReturnValue(`
    CREATE TABLE public.users (
      id serial PRIMARY KEY
    );
  `);

  try {
    const result = runDiffSchema({
      directories: [ddlDir],
      extensions: ['.sql'],
      url: 'postgres://test:secret@cli-host:5432/diff-db',
      out: outputFile,
      dryRun: true
    });

    expect(result.dryRun).toBe(true);
    expect(result.hasChanges).toBe(false);
    expect(result.text).toContain('no schema differences detected');
    expect(result.text).toContain('Destructive risks\n- none');
    expect(result.text).toContain('Operational risks\n- none');
    expect(result.risks.destructiveRisks).toEqual([]);
    expect(result.risks.operationalRisks).toEqual([]);
    expect(existsSync(outputFile)).toBe(false);
    expect(existsSync(outputFile.replace(/\.sql$/, '.txt'))).toBe(false);
    expect(existsSync(outputFile.replace(/\.sql$/, '.json'))).toBe(false);
  } finally {
    spy.mockRestore();
  }
});

test('diff schema reports column and index rebuild risks from the apply plan', () => {
  const ddlDir = path.join(createTempDir('cli-diff-risk-matrix'), 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY,
        display_name text NOT NULL,
        nickname text NOT NULL
      );

      CREATE INDEX idx_users_display_name ON public.users(display_name);
    `,
    'utf8'
  );

  const outputFile = path.join(createTempDir('cli-diff-risk-matrix-output'), 'users.diff.sql');
  const remoteSql = `
    CREATE TABLE public.users (
      id serial PRIMARY KEY,
      name text,
      nickname integer
    );

    CREATE INDEX idx_users_display_name ON public.users(name);
  `;

  const spy = vi.spyOn(pgDumpUtil, 'runPgDump').mockReturnValue(remoteSql);
  try {
    const result = runDiffSchema({
      directories: [ddlDir],
      extensions: ['.sql'],
      url: 'postgres://test:secret@cli-host:5432/diff-db',
      out: outputFile
    });

    expect(result.risks.destructiveRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'drop_column', target: 'public.users.name' }),
        expect.objectContaining({ kind: 'alter_type', target: 'public.users.nickname' }),
        expect.objectContaining({ kind: 'nullability_tighten', target: 'public.users.nickname' }),
        expect.objectContaining({
          kind: 'rename_candidate',
          from: 'public.users.name',
          to: 'public.users.display_name'
        })
      ])
    );
    expect(result.risks.operationalRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'index_rebuild', target: 'idx_users_display_name' })
      ])
    );
  } finally {
    spy.mockRestore();
  }
});

test('diff schema reports supplemental-only index changes without table rebuild risks', () => {
  const ddlDir = path.join(createTempDir('cli-diff-supplemental-only'), 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY,
        display_name text NOT NULL
      );

      CREATE INDEX idx_users_display_name ON public.users(display_name);
    `,
    'utf8'
  );

  const outputFile = path.join(createTempDir('cli-diff-supplemental-only-output'), 'users.diff.sql');
  const remoteSql = `
    CREATE TABLE public.users (
      id serial PRIMARY KEY,
      display_name text NOT NULL
    );
  `;

  const spy = vi.spyOn(pgDumpUtil, 'runPgDump').mockReturnValue(remoteSql);
  try {
    const result = runDiffSchema({
      directories: [ddlDir],
      extensions: ['.sql'],
      url: 'postgres://test:secret@cli-host:5432/diff-db',
      out: outputFile
    });

    expect(result.hasChanges).toBe(true);
    expect(result.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schema: 'public',
          table: 'users',
          changeKind: 'schema_change',
          details: expect.objectContaining({
            message: 'apply index idx_users_display_name'
          })
        })
      ])
    );
    expect(result.applyPlan.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'reapply_statement',
          target: 'idx_users_display_name'
        }),
        expect.objectContaining({
          kind: 'index_rebuild_effect',
          target: 'idx_users_display_name'
        })
      ])
    );
    expect(result.applyPlan.operations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'recreate_table',
          target: 'public.users'
        })
      ])
    );
    expect(result.risks.destructiveRisks).toEqual([]);
    expect(result.risks.operationalRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'index_rebuild', target: 'idx_users_display_name' })
      ])
    );
  } finally {
    spy.mockRestore();
  }
});

test('diff schema does not misparse commas inside column types or constraints', () => {
  const ddlDir = path.join(createTempDir('cli-diff-top-level-comma'), 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'orders.sql'),
    `
      CREATE TABLE public.orders (
        id serial PRIMARY KEY,
        amount numeric(10,2) NOT NULL,
        status text NOT NULL,
        CONSTRAINT orders_status_check CHECK (status IN ('new', 'paid'))
      );
    `,
    'utf8'
  );

  const outputFile = path.join(createTempDir('cli-diff-top-level-comma-output'), 'orders.diff.sql');
  const remoteSql = `
    CREATE TABLE public.orders (
      id serial PRIMARY KEY,
      amount numeric(10,2) NOT NULL,
      status text NOT NULL,
      CONSTRAINT orders_status_check CHECK (status IN ('new', 'paid'))
    );
  `;

  const spy = vi.spyOn(pgDumpUtil, 'runPgDump').mockReturnValue(remoteSql);
  try {
    const result = runDiffSchema({
      directories: [ddlDir],
      extensions: ['.sql'],
      url: 'postgres://test:secret@cli-host:5432/diff-db',
      out: outputFile,
      dryRun: true
    });

    expect(result.hasChanges).toBe(false);
    expect(result.summary).toEqual([]);
    expect(result.risks.destructiveRisks).toEqual([]);
    expect(result.risks.operationalRisks).toEqual([]);
  } finally {
    spy.mockRestore();
  }
});

test('plan-based evaluator preserves ddl diff structured risks independently from rendering', () => {
  const plan = {
    operations: [
      { kind: 'drop_table_cascade', target: 'public.users' },
      { kind: 'recreate_table', target: 'public.users' },
      { kind: 'drop_column_effect', target: 'public.users.legacy_name' },
      { kind: 'index_rebuild_effect', target: 'idx_users_display_name' }
    ]
  } as const;

  const summary = [
    {
      schema: 'public',
      table: 'users',
      changeKind: 'drop_column' as const,
      details: { column: 'legacy_name', type: 'text' }
    }
  ];

  const risks = analyzeMigrationPlanRisks(plan, summary);
  expect(risks.destructiveRisks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'drop_table',
        target: 'public.users',
        avoidable: true,
        guidance: expect.arrayContaining(['cli_option_not_exposed'])
      }),
      expect.objectContaining({
        kind: 'drop_column',
        target: 'public.users.legacy_name'
      })
    ])
  );
  expect(risks.operationalRisks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'table_rebuild', target: 'public.users' }),
      expect.objectContaining({ kind: 'index_rebuild', target: 'idx_users_display_name' })
    ])
  );
});

test('sql-based evaluator can re-evaluate hand-edited migration SQL', () => {
  const handEditedSql = `
    DROP TABLE IF EXISTS public.users CASCADE;
    CREATE TABLE public.users (
      id serial PRIMARY KEY,
      display_name text NOT NULL
    );
    ALTER TABLE public.orders ALTER COLUMN total_amount TYPE numeric(12,2);
    ALTER TABLE public.orders ADD CONSTRAINT orders_total_amount_positive CHECK (total_amount > 0);
    ALTER TABLE public.client DROP COLUMN client_name;
    CREATE INDEX idx_users_display_name ON public.users(display_name);
  `;

  const risks = analyzeMigrationSqlRisks(handEditedSql);
  expect(risks.destructiveRisks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'drop_table', target: 'public.users' }),
      expect.objectContaining({ kind: 'cascade_drop', target: 'public.users' }),
      expect.objectContaining({ kind: 'alter_type', target: 'public.orders.total_amount' }),
      expect.objectContaining({ kind: 'drop_column', target: 'public.client.client_name' }),
      expect.objectContaining({ kind: 'semantic_constraint_change', target: 'public.orders' })
    ])
  );
  expect(risks.operationalRisks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'table_rebuild', target: 'public.users' }),
      expect.objectContaining({ kind: 'full_table_copy', target: 'public.users' }),
      expect.objectContaining({ kind: 'index_rebuild', target: 'idx_users_display_name' })
    ])
  );
});

test('sql-based evaluator supports same-line statements and rebuilt table constraints', () => {
  const risks = analyzeMigrationSqlRisks(
    'DROP TABLE public.users CASCADE; CREATE TABLE public.users (id serial PRIMARY KEY, email text NOT NULL, CONSTRAINT users_email_unique UNIQUE (email));'
  );

  expect(risks.destructiveRisks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'drop_table', target: 'public.users' }),
      expect.objectContaining({ kind: 'cascade_drop', target: 'public.users' }),
      expect.objectContaining({ kind: 'semantic_constraint_change', target: 'public.users' })
    ])
  );
  expect(risks.operationalRisks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'table_rebuild', target: 'public.users' }),
      expect.objectContaining({ kind: 'full_table_copy', target: 'public.users' })
    ])
  );
});
