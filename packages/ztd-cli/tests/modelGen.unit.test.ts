import { expect, test } from 'vitest';
import { bindModelGenNamedSql } from '../src/utils/modelGenBinder';
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

test('bindModelGenNamedSql reuses the same slot for repeated names in SQL order', () => {
  const bound = bindModelGenNamedSql('select * from demo where a = :id or b = :id and c = :name');
  expect(bound.orderedParamNames).toEqual(['id', 'name']);
  expect(bound.boundSql).toContain('a = $1 or b = $1 and c = $2');
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
