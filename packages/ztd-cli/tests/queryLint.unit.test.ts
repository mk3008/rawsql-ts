import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, expect, test, vi } from 'vitest';
import { activeOrdersCatalog } from '../src/specs/sql/activeOrders.catalog';
import { usersListCatalog } from '../src/specs/sql/usersList.catalog';
import { registerQueryCommands } from '../src/commands/query';
import { buildQueryLintReport, formatQueryLintReport } from '../src/query/lint';
import { TAX_ALLOCATION_QUERY } from './utils/taxAllocationScenario';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');
const originalProjectRoot = process.env.ZTD_PROJECT_ROOT;

afterEach(() => {
  process.env.ZTD_PROJECT_ROOT = originalProjectRoot;
});

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function createSqlWorkspace(prefix: string, sqlRelativePath: string = path.join('src', 'sql', 'query.sql')): {
  rootDir: string;
  sqlFile: string;
} {
  const rootDir = createTempDir(prefix);
  const sqlFile = path.join(rootDir, sqlRelativePath);
  mkdirSync(path.dirname(sqlFile), { recursive: true });
  return { rootDir, sqlFile };
}

function createJoinDirectionWorkspace(prefix: string): {
  rootDir: string;
  sqlFile: string;
  ddlDir: string;
} {
  const rootDir = createTempDir(prefix);
  const ddlDir = path.join(rootDir, 'ztd', 'ddl');
  const sqlFile = path.join(rootDir, 'src', 'sql', 'query.sql');
  mkdirSync(path.dirname(sqlFile), { recursive: true });
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(rootDir, 'ztd.config.json'),
    JSON.stringify({
      ddlDir: 'ztd/ddl',
      ddl: {
        defaultSchema: 'public',
        searchPath: ['public']
      }
    }, null, 2),
    'utf8'
  );
  return { rootDir, sqlFile, ddlDir };
}

function writeJoinDirectionUsersOrdersSchema(ddlDir: string): void {
  writeFileSync(
    path.join(ddlDir, 'schema.sql'),
    `
      CREATE TABLE public.users (
        id integer PRIMARY KEY,
        email text NOT NULL,
        active integer NOT NULL
      );

      CREATE TABLE public.orders (
        id integer PRIMARY KEY,
        user_id integer NOT NULL REFERENCES public.users(id),
        total integer NOT NULL
      );
    `,
    'utf8'
  );
}

function writeJoinDirectionInvoiceSchema(ddlDir: string): void {
  writeFileSync(
    path.join(ddlDir, 'schema.sql'),
    `
      CREATE TABLE public.invoice_lines (
        invoice_id integer NOT NULL,
        id integer PRIMARY KEY,
        amount_cents integer NOT NULL,
        tax_rate_basis_points integer NOT NULL
      );
    `,
    'utf8'
  );
}

function writeJoinDirectionSchema(ddlDir: string): void {
  writeFileSync(
    path.join(ddlDir, 'schema.sql'),
    `
      CREATE TABLE public.customers (
        customer_id integer PRIMARY KEY
      );

      CREATE TABLE public.orders (
        order_id integer PRIMARY KEY,
        customer_id integer NOT NULL REFERENCES public.customers(customer_id)
      );

      CREATE TABLE public.order_items (
        order_item_id integer PRIMARY KEY,
        order_id integer NOT NULL REFERENCES public.orders(order_id)
      );

      CREATE TABLE public.sales (
        sale_id integer PRIMARY KEY
      );

      CREATE TABLE public.tags (
        tag_id integer PRIMARY KEY
      );

      CREATE TABLE public.sale_item_tags (
        sale_id integer NOT NULL REFERENCES public.sales(sale_id),
        tag_id integer NOT NULL REFERENCES public.tags(tag_id)
      );
    `,
    'utf8'
  );
}

function readJoinDirectionFixture(name: string): string {
  return readFileSync(path.join(__dirname, 'fixtures', 'join-direction', name), 'utf8');
}

function createQueryLintProgram(capture: { stdout: string[]; stderr: string[] }): Command {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => capture.stdout.push(str),
    writeErr: (str) => capture.stderr.push(str)
  });
  registerQueryCommands(program);
  return program;
}

test('buildQueryLintReport detects structural maintainability issues', () => {
  const workspace = createSqlWorkspace('query-lint-report', path.join('src', 'sql', 'reports', 'maintainability.sql'));
  const oversizedProjection = Array.from({ length: 120 }, (_, index) => `          id + ${index} as value_${index}`).join(',\n');
  writeFileSync(
    workspace.sqlFile,
    `
      with base_users as (
        select u.id, u.region_id
        from public.users u
        join public.regions r on r.id = u.region_id
        where u.active = true
      ),
      filtered_users as (
        select u.id, u.region_id
        from public.users u
        join public.regions r on r.id = u.region_id
        where u.active = true
      ),
      oversized_stage as (
        select
${oversizedProjection}
        from filtered_users
      ),
      unused_stage as (
        select * from public.audit_log
      )
      select format('select %s from users', id)
      from oversized_stage
    `,
    'utf8'
  );

  const report = buildQueryLintReport(workspace.sqlFile);

  expect(report).toMatchObject({
    file: workspace.sqlFile,
    query_type: 'SELECT',
    cte_count: 4
  });
  expect(report.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'unused-cte', cte: 'base_users', severity: 'warning' }),
    expect.objectContaining({ type: 'unused-cte', cte: 'unused_stage', severity: 'warning' }),
    expect.objectContaining({ type: 'duplicate-join-block', severity: 'warning' }),
    expect.objectContaining({ type: 'duplicate-filter-predicate', severity: 'warning' }),
    expect.objectContaining({ type: 'large-cte', cte: 'oversized_stage', severity: 'info' }),
    expect.objectContaining({ type: 'analysis-risk', risk_pattern: 'format-sql-construction', severity: 'warning' })
  ]));
});

test('buildQueryLintReport does not flag legal recursive CTEs as dependency cycles', () => {
  const workspace = createSqlWorkspace('query-lint-recursive');
  writeFileSync(
    workspace.sqlFile,
    `
      with recursive walk as (
        select id, parent_id
        from public.nodes
        where parent_id is null
        union all
        select n.id, n.parent_id
        from public.nodes n
        join walk w on w.id = n.parent_id
      )
      select * from walk
    `,
    'utf8'
  );

  const report = buildQueryLintReport(workspace.sqlFile);

  expect(report.issues.filter((issue) => issue.type === 'dependency-cycle')).toEqual([]);
});

test('buildQueryLintReport detects dependency cycles as errors', () => {
  const workspace = createSqlWorkspace('query-lint-cycle');
  writeFileSync(
    workspace.sqlFile,
    `
      with a as (
        select * from b
      ),
      b as (
        select * from a
      )
      select * from a
    `,
    'utf8'
  );

  const report = buildQueryLintReport(workspace.sqlFile);

  expect(report.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'dependency-cycle',
      severity: 'error',
      cycle: ['a', 'b', 'a'],
      message: 'invalid dependency cycle detected (a -> b -> a)'
    })
  ]));
});

test('formatQueryLintReport renders json for agents and compact text for humans', () => {
  const workspace = createSqlWorkspace('query-lint-format');
  writeFileSync(
    workspace.sqlFile,
    `
      with unused_stage as (
        select id from public.users
      )
      select 1
    `,
    'utf8'
  );

  const report = buildQueryLintReport(workspace.sqlFile);
  const jsonOutput = formatQueryLintReport(report, 'json');
  expect(JSON.parse(jsonOutput)).toEqual(report);

  const textOutput = formatQueryLintReport(report, 'text');
  expect(textOutput).toContain('WARN  unused-cte: unused_stage is defined but never used');
});

test('buildQueryLintReport keeps the forward join-direction dogfood query clean', () => {
  const workspace = createJoinDirectionWorkspace('query-lint-join-direction');
  writeJoinDirectionSchema(workspace.ddlDir);
  writeFileSync(workspace.sqlFile, readJoinDirectionFixture('forward.sql'), 'utf8');

  const report = buildQueryLintReport(workspace.sqlFile, {
    projectRoot: workspace.rootDir,
    rules: ['join-direction']
  });

  expect(report.issues.filter((issue) => issue.type === 'join-direction')).toEqual([]);
});

test('buildQueryLintReport warns on the reverse join-direction dogfood query', () => {
  const workspace = createJoinDirectionWorkspace('query-lint-join-direction-reversed');
  writeJoinDirectionSchema(workspace.ddlDir);
  writeFileSync(workspace.sqlFile, readJoinDirectionFixture('reverse.sql'), 'utf8');

  const report = buildQueryLintReport(workspace.sqlFile, {
    projectRoot: workspace.rootDir,
    rules: ['join-direction']
  });

  expect(report.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: 'join-direction',
        severity: 'warning',
        subject_table: 'public.customers',
        joined_table: 'public.orders',
        child_table: 'public.orders',
        parent_table: 'public.customers'
      })
    ])
  );
});

test('buildQueryLintReport suppresses join-direction when explicitly disabled in SQL text', () => {
  const workspace = createJoinDirectionWorkspace('query-lint-join-direction-suppressed');
  writeJoinDirectionSchema(workspace.ddlDir);
  writeFileSync(workspace.sqlFile, readJoinDirectionFixture('suppressed.sql'), 'utf8');

  const report = buildQueryLintReport(workspace.sqlFile, {
    projectRoot: workspace.rootDir,
    rules: ['join-direction']
  });

  expect(report.issues.filter((issue) => issue.type === 'join-direction')).toEqual([]);
});

test('buildQueryLintReport skips left-join dogfood queries because preserving the parent row is intentional', () => {
  const workspace = createJoinDirectionWorkspace('query-lint-join-direction-left');
  writeJoinDirectionSchema(workspace.ddlDir);
  writeFileSync(workspace.sqlFile, readJoinDirectionFixture('left-join.sql'), 'utf8');

  const report = buildQueryLintReport(workspace.sqlFile, {
    projectRoot: workspace.rootDir,
    rules: ['join-direction']
  });

  expect(report.issues.filter((issue) => issue.type === 'join-direction')).toEqual([]);
});

test('buildQueryLintReport skips bridge-table dogfood queries because many-to-many paths are intentionally exempt in v1', () => {
  const workspace = createJoinDirectionWorkspace('query-lint-join-direction-bridge');
  writeJoinDirectionSchema(workspace.ddlDir);
  writeFileSync(workspace.sqlFile, readJoinDirectionFixture('bridge.sql'), 'utf8');

  const report = buildQueryLintReport(workspace.sqlFile, {
    projectRoot: workspace.rootDir,
    rules: ['join-direction']
  });

  expect(report.issues.filter((issue) => issue.type === 'join-direction')).toEqual([]);
});

test('buildQueryLintReport skips aggregate dogfood queries because the parent-shaped summary is intentionally ambiguous', () => {
  const workspace = createJoinDirectionWorkspace('query-lint-join-direction-aggregate');
  writeJoinDirectionSchema(workspace.ddlDir);
  writeFileSync(workspace.sqlFile, readJoinDirectionFixture('aggregate.sql'), 'utf8');

  const report = buildQueryLintReport(workspace.sqlFile, {
    projectRoot: workspace.rootDir,
    rules: ['join-direction']
  });

  expect(report.issues.filter((issue) => issue.type === 'join-direction')).toEqual([]);
});

test('query lint command enables join-direction through --rules', async () => {
  const workspace = createJoinDirectionWorkspace('query-lint-join-direction-cli');
  writeJoinDirectionSchema(workspace.ddlDir);
  writeFileSync(
    workspace.sqlFile,
    `
      select
        c.customer_id,
        o.order_id
      from public.customers c
      join public.orders o
        on o.customer_id = c.customer_id
    `,
    'utf8'
  );

  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createQueryLintProgram(capture);
  const logSpy = vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
    capture.stdout.push(String(value ?? ''));
  });

  process.env.ZTD_PROJECT_ROOT = workspace.rootDir;
  try {
    await program.parseAsync(['query', 'lint', workspace.sqlFile, '--rules', 'join-direction'], { from: 'user' });
  } finally {
    logSpy.mockRestore();
  }

  expect(capture.stderr).toEqual([]);
  expect(capture.stdout.join('')).toContain('WARN  join-direction: JOIN direction is reversed for public.orders -> public.customers');
});

test('query lint command emits join-direction diagnostics in json mode', async () => {
  const workspace = createJoinDirectionWorkspace('query-lint-join-direction-cli-json');
  writeJoinDirectionSchema(workspace.ddlDir);
  writeFileSync(
    workspace.sqlFile,
    `
      select
        c.customer_id,
        o.order_id
      from public.customers c
      join public.orders o
        on o.customer_id = c.customer_id
    `,
    'utf8'
  );

  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createQueryLintProgram(capture);
  const logSpy = vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
    capture.stdout.push(String(value ?? ''));
  });

  process.env.ZTD_PROJECT_ROOT = workspace.rootDir;
  try {
    await program.parseAsync(['query', 'lint', workspace.sqlFile, '--rules', 'join-direction', '--format', 'json'], { from: 'user' });
  } finally {
    logSpy.mockRestore();
  }

  expect(capture.stderr).toEqual([]);
  const payload = JSON.parse(capture.stdout.join(''));
  expect(payload.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'join-direction',
      severity: 'warning',
      parent_table: 'public.customers',
      child_table: 'public.orders'
    })
  ]));
});

test('activeOrdersCatalog.sql stays clean because it already follows child-to-parent join direction', () => {
  const workspace = createJoinDirectionWorkspace('query-lint-active-orders-repo-sql');
  writeJoinDirectionUsersOrdersSchema(workspace.ddlDir);
  writeFileSync(workspace.sqlFile, activeOrdersCatalog.sql, 'utf8');

  const report = buildQueryLintReport(workspace.sqlFile, {
    projectRoot: workspace.rootDir,
    rules: ['join-direction']
  });

  expect(report.issues.filter((issue) => issue.type === 'join-direction')).toEqual([]);
});

test('usersListCatalog.sql is skipped because it has no join graph to evaluate', () => {
  const workspace = createJoinDirectionWorkspace('query-lint-users-list-repo-sql');
  writeJoinDirectionUsersOrdersSchema(workspace.ddlDir);
  writeFileSync(workspace.sqlFile, usersListCatalog.sql, 'utf8');

  const report = buildQueryLintReport(workspace.sqlFile, {
    projectRoot: workspace.rootDir,
    rules: ['join-direction']
  });

  expect(report.issues.filter((issue) => issue.type === 'join-direction')).toEqual([]);
});

test('tax allocation repo SQL is skipped because the parent-shaped aggregate and LEFT JOIN make the direction ambiguous by design', () => {
  const workspace = createJoinDirectionWorkspace('query-lint-tax-allocation-repo-sql');
  writeJoinDirectionInvoiceSchema(workspace.ddlDir);
  writeFileSync(workspace.sqlFile, TAX_ALLOCATION_QUERY, 'utf8');

  const report = buildQueryLintReport(workspace.sqlFile, {
    projectRoot: workspace.rootDir,
    rules: ['join-direction']
  });

  expect(report.issues.filter((issue) => issue.type === 'join-direction')).toEqual([]);
});
