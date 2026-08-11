import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DDL_SOURCE_LIMITS, resolveDdlSources } from '../src/ddlSources';
import { McpInputError } from '../src/inputError';
import {
  formatGeneratedSqlArtifact,
  formatRequestedSql,
  generatedSqlArtifact,
  resolveSqlFormatting,
} from '../src/sqlFormatting';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('DDL source resolution', () => {
  it('loads one workspace-relative SQL file with its source identity', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    writeSql(workspace, 'schema/orders.sql', 'create table orders (id bigint);');

    expect(resolveDdlSources({ workspaceRoot: workspace, paths: 'schema/orders.sql' })).toEqual([
      { filePath: 'schema/orders.sql', sql: 'create table orders (id bigint);' },
    ]);
  });

  it('loads multiple files in deterministic workspace-relative order', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    writeSql(workspace, 'schema/z.sql', 'create table z (id bigint);');
    writeSql(workspace, 'schema/a.sql', 'create table a (id bigint);');

    const first = resolveDdlSources({
      workspaceRoot: workspace,
      paths: ['schema/z.sql', 'schema/a.sql'],
    });
    const second = resolveDdlSources({
      workspaceRoot: workspace,
      paths: ['schema/a.sql', 'schema/z.sql'],
    });

    expect(first.map((source) => source.filePath)).toEqual(['schema/a.sql', 'schema/z.sql']);
    expect(second).toEqual(first);
  });

  it('recursively loads nested SQL while applying the existing ignored-directory policy', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    writeSql(workspace, 'schema/root.sql', 'create table root_record (id bigint);');
    writeSql(workspace, 'schema/nested/child.sql', 'create table child_record (id bigint);');
    writeSql(workspace, 'schema/node_modules/ignored.sql', 'create table ignored (id bigint);');
    writeSql(workspace, 'schema/.git/also-ignored.sql', 'create table also_ignored (id bigint);');
    writeFile(workspace, 'schema/nested/readme.txt', 'not ddl');

    expect(resolveDdlSources({ workspaceRoot: workspace, paths: 'schema' }).map((source) => source.filePath)).toEqual([
      'schema/nested/child.sql',
      'schema/root.sql',
    ]);
  });

  it('keeps inline and file-backed DDL as separate ordered analysis sources', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    writeSql(workspace, 'schema/orders.sql', 'create table orders (id bigint);');

    expect(resolveDdlSources({
      inlineDdl: [
        'create table inline_a (id bigint);',
        'create table inline_b (id bigint);',
      ],
      paths: 'schema/orders.sql',
      workspaceRoot: workspace,
    })).toEqual([
      { filePath: '<inline:1>', sql: 'create table inline_a (id bigint);' },
      { filePath: '<inline:2>', sql: 'create table inline_b (id bigint);' },
      { filePath: 'schema/orders.sql', sql: 'create table orders (id bigint);' },
    ]);
  });

  it('preserves conflicting schema-object sources without choosing a winner', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    writeSql(workspace, 'schema/first.sql', 'create table orders (id bigint);');
    writeSql(workspace, 'schema/second.sql', 'create table orders (id text);');

    expect(resolveDdlSources({ workspaceRoot: workspace, paths: 'schema' })).toEqual([
      { filePath: 'schema/first.sql', sql: 'create table orders (id bigint);' },
      { filePath: 'schema/second.sql', sql: 'create table orders (id text);' },
    ]);
  });

  it('deduplicates the same canonical file without merging schema content', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    writeSql(workspace, 'schema/orders.sql', 'create table orders (id bigint);');

    const sources = resolveDdlSources({
      workspaceRoot: workspace,
      paths: ['schema', 'schema/orders.sql'],
    });

    expect(sources).toHaveLength(1);
    expect(sources[0].filePath).toBe('schema/orders.sql');
  });

  it.each([
    ['parent traversal', '../outside.sql', 'WORKSPACE_PATH_TRAVERSAL'],
    ['absolute path', resolve('outside.sql'), 'WORKSPACE_PATH_ABSOLUTE'],
    ['missing path', 'schema/missing.sql', 'WORKSPACE_PATH_NOT_FOUND'],
  ])('rejects %s', (_label, requestedPath, code) => {
    const workspace = temporaryDirectory('ddl-workspace-');
    expectInputError(
      () => resolveDdlSources({ workspaceRoot: workspace, paths: requestedPath }),
      code,
    );
  });

  it('rejects a workspace symlink or junction that escapes through realpath', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    const outside = temporaryDirectory('ddl-outside-');
    writeSql(outside, 'external.sql', 'create table external_record (id bigint);');
    createDirectoryLink(outside, join(workspace, 'linked'));

    expectInputError(
      () => resolveDdlSources({ workspaceRoot: workspace, paths: 'linked' }),
      'WORKSPACE_PATH_ESCAPE',
    );
  });

  it('rejects a directory with no discoverable SQL', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    writeFile(workspace, 'schema/readme.txt', 'not ddl');

    expectInputError(
      () => resolveDdlSources({ workspaceRoot: workspace, paths: 'schema' }),
      'DDL_DIRECTORY_EMPTY',
    );
  });

  it('accepts exact scan limits and rejects the first file beyond them', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    writeSql(workspace, 'schema/a.sql', 'a');
    writeSql(workspace, 'schema/b.sql', 'b');
    writeSql(workspace, 'schema/c.sql', 'c');

    expect(resolveDdlSources({
      limits: { maxFiles: 2 },
      paths: ['schema/a.sql', 'schema/b.sql'],
      workspaceRoot: workspace,
    })).toHaveLength(2);
    expectInputError(
      () => resolveDdlSources({ limits: { maxFiles: 2 }, paths: 'schema', workspaceRoot: workspace }),
      'DDL_FILE_LIMIT',
    );
  });

  it('accepts the exact total byte limit and rejects one additional byte', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    writeSql(workspace, 'schema/a.sql', 'abc');
    writeSql(workspace, 'schema/b.sql', 'de');

    expect(resolveDdlSources({
      limits: { maxTotalBytes: 5 },
      paths: 'schema',
      workspaceRoot: workspace,
    })).toHaveLength(2);
    expectInputError(
      () => resolveDdlSources({ limits: { maxTotalBytes: 4 }, paths: 'schema', workspaceRoot: workspace }),
      'DDL_TOTAL_SIZE_LIMIT',
    );
  });

  it('enforces per-file and inline byte limits at their exact boundaries', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    writeSql(workspace, 'schema/exact.sql', 'abc');
    writeSql(workspace, 'schema/over.sql', 'abcd');

    expect(resolveDdlSources({
      limits: { maxFileBytes: 3 },
      paths: 'schema/exact.sql',
      workspaceRoot: workspace,
    })[0].sql).toBe('abc');
    expectInputError(
      () => resolveDdlSources({ limits: { maxFileBytes: 3 }, paths: 'schema/over.sql', workspaceRoot: workspace }),
      'DDL_FILE_SIZE_LIMIT',
    );

    expect(resolveDdlSources({
      inlineDdl: 'abc',
      limits: { maxInlineBytes: 3 },
      workspaceRoot: workspace,
    })[0].sql).toBe('abc');
    expectInputError(
      () => resolveDdlSources({ inlineDdl: 'abcd', limits: { maxInlineBytes: 3 }, workspaceRoot: workspace }),
      'DDL_FILE_SIZE_LIMIT',
    );
  });

  it('accepts path-backed DDL above the inline limit while keeping inline DDL bounded', () => {
    const workspace = temporaryDirectory('ddl-workspace-');
    const sql = 'x'.repeat(DEFAULT_DDL_SOURCE_LIMITS.maxInlineBytes + 1);
    writeSql(workspace, 'schema/pg-dump.sql', sql);

    expect(DEFAULT_DDL_SOURCE_LIMITS.maxFileBytes).toBe(50 * 1024 * 1024);
    expect(resolveDdlSources({
      paths: 'schema/pg-dump.sql',
      workspaceRoot: workspace,
    })[0].sql).toHaveLength(sql.length);
    expectInputError(
      () => resolveDdlSources({ inlineDdl: sql, workspaceRoot: workspace }),
      'DDL_FILE_SIZE_LIMIT',
    );
  });
});

describe('SQL formatting resolution', () => {
  it('leaves generated SQL unchanged when format is absent', () => {
    const workspace = temporaryDirectory('format-workspace-');
    const formatting = resolveSqlFormatting(workspace);
    const artifact = generatedSqlArtifact('cte-extraction', 'select id from orders');

    expect(formatting).toEqual({ enabled: false, options: {} });
    expect(formatGeneratedSqlArtifact(artifact, formatting)).toBe(artifact);
  });

  it('formats explicitly requested SQL without a generated-artifact wrapper', () => {
    const workspace = temporaryDirectory('format-workspace-');
    const formatting = resolveSqlFormatting(workspace, {});

    expect(formatRequestedSql('select customer_id,amount from orders', formatting))
      .toBe('select "customer_id", "amount" from "orders"');
  });

  it('maps requested SQL parse failures to a dedicated stable error', () => {
    const workspace = temporaryDirectory('format-workspace-');
    const formatting = resolveSqlFormatting(workspace, {});

    expectInputError(() => formatRequestedSql('select 1; select 2', formatting), 'SQL_FORMAT_FAILED');
  });

  it('resolves a configPath-only formatter configuration', () => {
    const workspace = temporaryDirectory('format-workspace-');
    writeJson(workspace, 'config/formatter.json', { keywordCase: 'upper', commaBreak: 'before' });

    expect(resolveSqlFormatting(workspace, { configPath: 'config/formatter.json' })).toEqual({
      enabled: true,
      options: { keywordCase: 'upper', commaBreak: 'before' },
    });
  });

  it('resolves inline options without a config file', () => {
    const workspace = temporaryDirectory('format-workspace-');

    expect(resolveSqlFormatting(workspace, { options: { keywordCase: 'lower', indentSize: 4 } })).toEqual({
      enabled: true,
      options: { keywordCase: 'lower', indentSize: 4 },
    });
  });

  it('applies inline options after configPath options', () => {
    const workspace = temporaryDirectory('format-workspace-');
    writeJson(workspace, 'formatter.json', { keywordCase: 'upper', indentSize: 2 });

    expect(resolveSqlFormatting(workspace, {
      configPath: 'formatter.json',
      options: { indentSize: 6 },
    }).options).toEqual({ keywordCase: 'upper', indentSize: 6 });
  });

  it.each([
    ['invalid JSON', 'FORMAT_CONFIG_INVALID_JSON', () => '{ invalid'],
    ['non-object config', 'FORMAT_OPTIONS_INVALID', () => JSON.stringify([])],
    ['invalid option value', 'FORMAT_OPTIONS_INVALID', () => JSON.stringify({ keywordCase: 'sideways' })],
    ['unknown option', 'FORMAT_OPTION_UNKNOWN', () => JSON.stringify({ inventedOption: true })],
  ])('fails fast for %s', (_label, code, content) => {
    const workspace = temporaryDirectory('format-workspace-');
    writeFile(workspace, 'formatter.json', content());

    expectInputError(
      () => resolveSqlFormatting(workspace, { configPath: 'formatter.json' }),
      code,
    );
  });

  it('maps invalid inline options to the existing MCP input error contract', () => {
    const workspace = temporaryDirectory('format-workspace-');

    expectInputError(
      () => resolveSqlFormatting(workspace, { options: { keywordCase: 'sideways' } as never }),
      'FORMAT_OPTIONS_INVALID',
    );
  });

  it.each(['toString', 'constructor', '__proto__'])('rejects prototype key %s from formatter config', (key) => {
    const workspace = temporaryDirectory('format-workspace-');
    writeJson(workspace, 'formatter.json', { [key]: true });

    expectInputError(
      () => resolveSqlFormatting(workspace, { configPath: 'formatter.json' }),
      'FORMAT_OPTION_UNKNOWN',
    );
  });

  it.each(['toString', 'constructor', '__proto__'])('rejects prototype key %s from inline options', (key) => {
    const workspace = temporaryDirectory('format-workspace-');
    const options = JSON.parse(`{"${key}":true}`) as never;

    expectInputError(
      () => resolveSqlFormatting(workspace, { options }),
      'FORMAT_OPTION_UNKNOWN',
    );
  });

  it.each([
    ['missing config', 'missing.json', 'WORKSPACE_PATH_NOT_FOUND'],
    ['absolute config', resolve('formatter.json'), 'WORKSPACE_PATH_ABSOLUTE'],
    ['outside config', '../formatter.json', 'WORKSPACE_PATH_TRAVERSAL'],
  ])('rejects %s', (_label, configPath, code) => {
    const workspace = temporaryDirectory('format-workspace-');
    expectInputError(() => resolveSqlFormatting(workspace, { configPath }), code);
  });

  it('rejects a config reached through a workspace symlink or junction escape', () => {
    const workspace = temporaryDirectory('format-workspace-');
    const outside = temporaryDirectory('format-outside-');
    writeJson(outside, 'formatter.json', { keywordCase: 'upper' });
    createDirectoryLink(outside, join(workspace, 'linked'));

    expectInputError(
      () => resolveSqlFormatting(workspace, { configPath: 'linked/formatter.json' }),
      'WORKSPACE_PATH_ESCAPE',
    );
  });

  it('formats the same generated SQL deterministically and preserves artifact metadata', () => {
    const workspace = temporaryDirectory('format-workspace-');
    const formatting = resolveSqlFormatting(workspace, {
      options: { keywordCase: 'upper', indentSize: 2 },
    });
    const artifact = {
      ...generatedSqlArtifact('fixture-extraction', 'select customer_id,amount from orders where customer_id=:customer_id'),
      stepId: 'capture:orders',
    };

    const first = formatGeneratedSqlArtifact(artifact, formatting);
    const second = formatGeneratedSqlArtifact(artifact, formatting);

    expect(second).toEqual(first);
    expect(first).toMatchObject({ artifactKind: 'fixture-extraction', stepId: 'capture:orders' });
    expect(first.sql).not.toBe(artifact.sql);
    expect(first.sql).toContain('SELECT');
  });

  it('rejects evidence-shaped SQL objects at runtime instead of traversing them', () => {
    const workspace = temporaryDirectory('format-workspace-');
    const formatting = resolveSqlFormatting(workspace, { options: { keywordCase: 'upper' } });
    const evidence = {
      expressionSql: 'amount * tax_rate',
      originalSql: 'select amount * tax_rate from orders',
      snippet: 'amount * tax_rate',
    };

    expectInputError(
      () => formatGeneratedSqlArtifact(evidence as never, formatting),
      'GENERATED_SQL_ARTIFACT_INVALID',
    );
    expect(evidence).toEqual({
      expressionSql: 'amount * tax_rate',
      originalSql: 'select amount * tax_rate from orders',
      snippet: 'amount * tax_rate',
    });
  });
});

if (false) {
  const workspace = '';
  const formatting = resolveSqlFormatting(workspace);
  // @ts-expect-error Evidence SQL is not a generated SQL artifact.
  formatGeneratedSqlArtifact({ expressionSql: 'amount * tax_rate' }, formatting);
}

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(resolve(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function writeSql(root: string, relativePath: string, sql: string): void {
  writeFile(root, relativePath, sql);
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  writeFile(root, relativePath, `${JSON.stringify(value)}\n`);
}

function writeFile(root: string, relativePath: string, content: string): void {
  const target = join(root, relativePath);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

function createDirectoryLink(target: string, link: string): void {
  symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
}

function expectInputError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error(`Expected McpInputError ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(McpInputError);
    expect(error).toMatchObject({ code });
  }
}
