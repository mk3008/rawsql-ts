import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildObservedSqlMatchReport,
  formatObservedSqlMatchReport
} from '../src';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function writeSqlFile(filePath: string, sql: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, sql.trim() + '\n', 'utf8');
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

describe('observed SQL matching', () => {
  it('ranks the original asset above distractors even when optional predicates are pruned', () => {
    const workspace = createTempDir('observed-sql-match');
    const primarySqlFile = path.join(workspace, 'src', 'sql', 'users', 'list.sql');
    const distractorSqlFile = path.join(workspace, 'src', 'sql', 'products', 'list.sql');
    const joinDivergenceSqlFile = path.join(workspace, 'src', 'sql', 'users', 'list-with-join.sql');

    writeSqlFile(
      primarySqlFile,
      `
        SELECT account.user_id, account.email
        FROM public.users account
        WHERE (:active IS NULL OR account.active = :active)
        ORDER BY account.created_at DESC
        LIMIT :limit
      `
    );
    writeSqlFile(
      distractorSqlFile,
      `
        SELECT product.product_id, product.name
        FROM public.products product
        WHERE product.active = true
        ORDER BY product.created_at DESC
      `
    );
    writeSqlFile(
      joinDivergenceSqlFile,
      `
        SELECT account.user_id, account.email
        FROM public.users account
        JOIN public.orders ord ON ord.user_id = account.user_id
        WHERE account.active = true
      `
    );

    const report = buildObservedSqlMatchReport({
      rootDir: workspace,
      observedSql: `
        SELECT u.user_id, u.email
        FROM public.users u
        WHERE u.active = true
        ORDER BY u.created_at DESC
        LIMIT 25
      `
    });

    expect(report.matches[0]?.sql_file).toBe('src/sql/users/list.sql');
    expect(report.matches[0]?.score).toBeGreaterThan(report.matches[1]?.score ?? 0);
    expect(report.matches[0]?.reasons.length).toBeGreaterThan(0);
    expect(report.matches[0]?.differences).toEqual(expect.any(Array));

    const json = formatObservedSqlMatchReport(report, 'json');
    const parsed = JSON.parse(json);
    expect(parsed).toMatchObject({
      schemaVersion: 1
    });
    expect(parsed.matches[0]).toMatchObject({
      sql_file: 'src/sql/users/list.sql',
      section_scores: expect.objectContaining({
        projection: expect.any(Number),
        source: expect.any(Number),
        where: expect.any(Number),
        order: expect.any(Number),
        paging: expect.any(Number)
      })
    });

    const text = normalizeText(formatObservedSqlMatchReport(report, 'text'));
    expect(text).toContain('Observed SQL match report');
    expect(text).toContain('Top matches:');
    expect(text).toContain('src/sql/users/list.sql#0');
    expect(text).toContain('reasons:');
    expect(text).toContain('differences:');
  });

  it('keeps boolean branch order stable and distinguishes function calls with different arguments', () => {
    const workspace = createTempDir('observed-sql-match-structure');
    const observedSql = `
      SELECT lower(u.email)
      FROM public.users u
      WHERE u.status = :status AND (u.deleted_at IS NULL OR u.active = true)
    `;

    writeSqlFile(
      path.join(workspace, 'src', 'sql', 'users', 'structure.sql'),
      `
        SELECT lower(u.email)
        FROM public.users u
        WHERE (u.active = true OR u.deleted_at IS NULL) AND u.status = :status
      `
    );

    writeSqlFile(
      path.join(workspace, 'src', 'sql', 'users', 'function-match.sql'),
      `
        SELECT lower(u.email)
        FROM public.users u
        WHERE lower(u.email) = :email
      `
    );

    writeSqlFile(
      path.join(workspace, 'src', 'sql', 'users', 'function-collision.sql'),
      `
        SELECT lower(u.status)
        FROM public.users u
        WHERE lower(u.status) = :status
      `
    );

    const report = buildObservedSqlMatchReport({
      rootDir: workspace,
      observedSql
    });

    expect(report.matches[0]?.sql_file).toBe('src/sql/users/structure.sql');
    expect(report.matches[0]?.score).toBeGreaterThan(report.matches[1]?.score ?? 0);
    const scoresByFile = Object.fromEntries(report.matches.map((match) => [match.sql_file, match.score]));
    expect(scoresByFile['src/sql/users/function-match.sql']).toBeGreaterThan(
      scoresByFile['src/sql/users/function-collision.sql'] ?? 0
    );
  });

  it('continues ranking when a candidate file cannot be read', () => {
    const workspace = createTempDir('observed-sql-match-partial-failure');
    const readableSqlFile = path.join(workspace, 'src', 'sql', 'users', 'good.sql');
    const unreadableSqlFile = path.join(workspace, 'src', 'sql', 'users', 'broken.sql');

    writeSqlFile(
      readableSqlFile,
      `
        SELECT u.user_id
        FROM public.users u
        WHERE u.active = true
      `
    );
    writeSqlFile(
      unreadableSqlFile,
      `
        SELECT u.user_id
        FROM public.users u
        WHERE u.active = true
      `
    );

    const report = buildObservedSqlMatchReport({
      rootDir: workspace,
      observedSql: `
        SELECT u.user_id
        FROM public.users u
        WHERE u.active = true
      `,
      readFileSync: (filePath) => {
        if (filePath.endsWith('broken.sql')) {
          throw new Error('simulated read failure');
        }
        return readFileSync(filePath, 'utf8');
      }
    });

    expect(report.matches[0]?.sql_file).toBe('src/sql/users/good.sql');
    expect(report.summary.filesRead).toBeGreaterThan(0);
    expect(report.summary.filesSkipped).toBe(1);
    expect(report.warnings.some((warning) => warning.code === 'file-read-failed')).toBe(true);
    expect(formatObservedSqlMatchReport(report, 'text')).toContain('files skipped: 1');
  });

  it('keeps formatter output stable when no candidate matches are found', () => {
    const workspace = createTempDir('observed-sql-match-empty');
    const report = buildObservedSqlMatchReport({
      rootDir: workspace,
      observedSql: 'SELECT 1'
    });

    const text = normalizeText(formatObservedSqlMatchReport(report, 'text'));
    expect(text).toContain('Top matches:');
    expect(text).toContain('(none)');
  });
});
