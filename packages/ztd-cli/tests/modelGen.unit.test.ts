import { expect, test } from 'vitest';
import {
  bindProbeSql,
  loadModelGenZtdFixtureState,
  normalizeCliPath,
  resolveModelGenZtdProbeOptions,
} from '../src/commands/modelGen';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { bindModelGenNamedSql } from '../src/utils/modelGenBinder';
import { buildProbeSql, probeQueryColumns } from '../src/utils/modelProbe';
import { deriveModelGenNames, normalizeGeneratedSqlFile, renderModelGenFile, toModelPropertyName } from '../src/utils/modelGenRender';
import { ModelGenSqlScanError, scanModelGenSql } from '../src/utils/modelGenScanner';

test('scanModelGenSql detects named parameters while skipping strings and comments', () => {
  const sql = `
    select ':ignored', "still:ignored"
    from users
    where id = :id
    -- and email = :ignored_comment
    /* and name = :ignored_block */
      and status = :status
  `;

  const result = scanModelGenSql(sql);
  expect(result.mode).toBe('named');
  expect(result.namedTokens.map((token) => token.name)).toEqual(['id', 'status']);
});

test('scanModelGenSql rejects unsupported placeholder syntaxes', () => {
  expect(() => scanModelGenSql('select * from users where id = :user-id')).toThrow(ModelGenSqlScanError);
  expect(() => scanModelGenSql('select * from users where id = :名前')).toThrow(ModelGenSqlScanError);
  expect(() => scanModelGenSql('select * from users where id = @userId')).toThrow(ModelGenSqlScanError);
  expect(() => scanModelGenSql('select * from users where id = ${userId}')).toThrow(ModelGenSqlScanError);
  expect(() => scanModelGenSql('select * from users where id = ?')).toThrow(ModelGenSqlScanError);
});

test('scanModelGenSql rejects mixed named and positional placeholders', () => {
  expect(() => scanModelGenSql('select * from users where id = :id and status = $1')).toThrow(ModelGenSqlScanError);
});

test('scanModelGenSql ignores PostgreSQL casts for named placeholders', () => {
  const result = scanModelGenSql('select :status::text as status');
  expect(result.mode).toBe('named');
  expect(result.namedTokens.map((token) => token.name)).toEqual(['status']);
  expect(result.positionalTokens).toEqual([]);
});

test('scanModelGenSql ignores PostgreSQL casts for positional placeholders', () => {
  const result = scanModelGenSql('select $1::uuid as user_id');
  expect(result.mode).toBe('positional');
  expect(result.namedTokens).toEqual([]);
  expect(result.positionalTokens.map((token) => token.token)).toEqual(['$1']);
});

test('bindModelGenNamedSql reuses the same slot for repeated names in SQL order', () => {
  const bound = bindModelGenNamedSql('select * from demo where a = :id or b = :id and c = :name');
  expect(bound.orderedParamNames).toEqual(['id', 'name']);
  expect(bound.boundSql).toContain('a = $1 or b = $1 and c = $2');
});

test('bindProbeSql derives positional params from scanner tokens and preserves sparse indexes', () => {
  const sql = "select '$99' as ignored, value from demo where a = $2 or b = $2";
  const bound = bindProbeSql(sql, scanModelGenSql(sql), true);
  expect(bound.boundSql).toBe(sql);
  expect(bound.orderedParamNames).toEqual(['$1', '$2']);
});

test('toModelPropertyName converts SQL columns to camelCase names', () => {
  expect(toModelPropertyName('sales_id')).toBe('salesId');
  expect(toModelPropertyName('customer-name')).toBe('customerName');
  expect(toModelPropertyName('1st_column')).toBe('_1stColumn');
});

test('deriveModelGenNames builds stable sql-contract identifiers from sql-root relative paths', () => {
  expect(deriveModelGenNames('sales/get_sales_header.sql')).toEqual({
    interfaceName: 'GetSalesHeaderRow',
    mappingName: 'getSalesHeaderMapping',
    specName: 'getSalesHeaderSpec',
    specId: 'sales.getSalesHeader'
  });
});

test('normalizeGeneratedSqlFile always uses forward slashes', () => {
  expect(normalizeGeneratedSqlFile('sales\\get_sales_header.sql')).toBe('sales/get_sales_header.sql');
});

test('renderModelGenFile emits names-first spec scaffolds', () => {
  const output = renderModelGenFile({
    command: 'ztd model-gen src/sql/sales/get_sales_header.sql',
    format: 'spec',
    sqlFile: 'sales/get_sales_header.sql',
    specId: 'sales.getSalesHeader',
    interfaceName: 'GetSalesHeaderRow',
    mappingName: 'getSalesHeaderMapping',
    specName: 'getSalesHeaderSpec',
    placeholderMode: 'named',
    allowPositional: false,
    orderedParamNames: ['sales_id'],
    columns: [
      { columnName: 'sales_id', propertyName: 'salesId', tsType: 'number' },
      { columnName: 'created_at', propertyName: 'createdAt', tsType: 'string' }
    ]
  });

  expect(output).toContain('// names-first reminder');
  expect(output).toContain("params: { shape: 'named', example: { sales_id: null } }");
  expect(output).toContain("salesId: 'sales_id'");
  expect(output).toContain("createdAt: 'created_at'");
});

test('renderModelGenFile escapes single quotes and backslashes in generated string literals', () => {
  const output = renderModelGenFile({
    command: 'ztd model-gen src/sql/demo.sql',
    format: 'spec',
    sqlFile: "sales\\owner's_report.sql",
    specId: "sales.owner'sReport",
    interfaceName: 'OwnerReportRow',
    mappingName: 'ownerReportMapping',
    specName: 'ownerReportSpec',
    placeholderMode: 'named',
    allowPositional: false,
    orderedParamNames: ['owner_id'],
    columns: [{ columnName: "owner's\\name", propertyName: 'ownerName', tsType: 'string' }]
  });

  expect(output).toContain("id: 'sales.owner\\'sReport'");
  expect(output).toContain("sqlFile: 'sales\\\\owner\\'s_report.sql'");
  expect(output).toContain("ownerName: 'owner\\'s\\\\name'");
});

test('renderModelGenFile marks positional scaffolds as legacy when explicitly allowed', () => {
  const output = renderModelGenFile({
    command: 'ztd model-gen legacy.sql --allow-positional',
    format: 'spec',
    sqlFile: 'legacy.sql',
    specId: 'legacy',
    interfaceName: 'LegacyRow',
    mappingName: 'legacyMapping',
    specName: 'legacySpec',
    placeholderMode: 'positional',
    allowPositional: true,
    orderedParamNames: ['$1', '$2'],
    columns: [{ columnName: 'value', propertyName: 'value', tsType: 'string' }]
  });

  expect(output).toContain('Legacy warning');
  expect(output).toContain("params: { shape: 'positional', example: [null, null] }");
});

test('normalizeCliPath converts windows-style paths to slash-separated paths', () => {
  expect(normalizeCliPath('src\\sql\\sales\\get_sales_header.sql')).toBe('src/sql/sales/get_sales_header.sql');
  expect(normalizeCliPath('src\\catalog\\specs\\get-sales-header.spec.ts')).toBe('src/catalog/specs/get-sales-header.spec.ts');
});

test('buildProbeSql trims trailing semicolons before wrapping the probe query', () => {
  expect(buildProbeSql('select 1 as value; \n')).toBe('SELECT * FROM (select 1 as value) AS _ztd_type_probe LIMIT 0');
});

test('probeQueryColumns maps int8 metadata to string to match pg driver defaults', async () => {
  let queryCall = 0;
  const client = {
    async query<T>(sql: string): Promise<{ fields?: unknown; rows?: T[] }> {
      queryCall += 1;
      if (queryCall === 1) {
        expect(sql).toContain('SELECT * FROM (select count(*) as total)');
        return {
          fields: [{ name: 'total', dataTypeID: 20 }],
          rows: []
        };
      }
      expect(sql).toContain('FROM pg_type');
      return {
        rows: [{ oid: 20, typname: 'int8', typtype: 'b', typelem: 0, typbasetype: 0 } as T]
      };
    }
  };

  await expect(probeQueryColumns(client, 'select count(*) as total', [])).resolves.toEqual([
    { columnName: 'total', typeName: 'int8', tsType: 'string' }
  ]);
});

test('resolveModelGenZtdProbeOptions preserves defaultSchema and searchPath from ztd.config.json', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'model-gen-ztd-config-'));
  mkdirSync(path.join(workspace, 'schema'), { recursive: true });
  writeFileSync(
    path.join(workspace, 'ztd.config.json'),
    JSON.stringify({
      dialect: 'postgres',
      ddlDir: 'schema',
      testsDir: 'tests',
      ddl: {
        defaultSchema: 'app',
        searchPath: ['app', 'public']
      },
      ddlLint: 'strict'
    }),
    'utf8'
  );

  expect(resolveModelGenZtdProbeOptions({ rootDir: workspace })).toEqual({
    ddlDirectories: [path.join(workspace, 'schema')],
    defaultSchema: 'app',
    searchPath: ['app', 'public']
  });
});

test('loadModelGenZtdFixtureState creates empty fixtures for DDL-only tables', async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'model-gen-ztd-fixtures-'));
  const ddlDir = path.join(workspace, 'schema');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'public.sql'),
    `
      CREATE TABLE public.users (
        user_id integer PRIMARY KEY,
        email text NOT NULL
      );
    `,
    'utf8'
  );

  const fixtureState = await loadModelGenZtdFixtureState({
    ddlDirectories: [ddlDir],
    defaultSchema: 'public',
    searchPath: ['public'],
  });

  expect(fixtureState.tableDefinitions).toHaveLength(1);
  expect(fixtureState.tableRows).toEqual([
    {
      tableName: 'public.users',
      rows: [],
    },
  ]);
});

test('loadModelGenZtdFixtureState keeps searchPath precedence for duplicate unqualified names', async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'model-gen-ztd-search-path-'));
  const ddlDir = path.join(workspace, 'schema');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'schemas.sql'),
    `
      CREATE SCHEMA app;

      CREATE TABLE app.users (
        account_id integer PRIMARY KEY
      );

      CREATE TABLE public.users (
        user_id integer PRIMARY KEY
      );
    `,
    'utf8'
  );

  const fixtureState = await loadModelGenZtdFixtureState({
    ddlDirectories: [ddlDir],
    defaultSchema: 'app',
    searchPath: ['app', 'public'],
  });

  expect(fixtureState.tableRows.map((fixture) => fixture.tableName)).toEqual([
    'app.users',
    'public.users',
  ]);
  expect(fixtureState.tableRows).toEqual([
    {
      tableName: 'app.users',
      rows: [],
    },
    {
      tableName: 'public.users',
      rows: [],
    },
  ]);
});
