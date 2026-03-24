import { writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  createTableDefinitionFromCreateTableQuery,
  CreateTableQuery,
  MultiQuerySplitter,
  SqlFormatter,
  SqlParser,
  type ValueComponent
} from 'rawsql-ts';
import type { DdlLintMode, TableNameResolver } from '@rawsql-ts/testkit-core';
import { ensureTestkitCoreModule } from '../utils/optionalDependencies';
import { collectSqlFiles, SqlSource } from '../utils/collectSqlFiles';
import { mapSqlTypeToTs } from '../utils/typeMapper';
import { ensureDirectory } from '../utils/fs';

export interface ZtdConfigGenerationOptions {
  directories: string[];
  extensions: string[];
  out: string;
  defaultSchema?: string;
  searchPath?: string[];
  ddlLint?: DdlLintMode;
  dryRun?: boolean;
}

export interface ColumnMetadata {
  name: string;
  typeName?: string;
  isNullable: boolean;
  required: boolean;
  defaultValue: string | null;
  isNotNull: boolean;
}

export interface TableMetadata {
  name: string;
  testRowInterfaceName: string;
  columns: ColumnMetadata[];
}

export interface ZtdConfigGenerationResult {
  tables: TableMetadata[];
  rendered: string;
  manifestRendered: string;
  outFile: string;
  manifestOutFile: string;
  dryRun: boolean;
}

export async function runGenerateZtdConfig(options: ZtdConfigGenerationOptions): Promise<ZtdConfigGenerationResult> {
  const testkitCore = await ensureTestkitCoreModule();
  const {
    TableNameResolver,
    DdlLintError,
    applyDdlLintMode,
    formatDdlLintDiagnostics,
    lintDdlSources,
    normalizeDdlLintMode
  } = testkitCore;

  const sources = collectSqlFiles(options.directories, options.extensions);
  if (sources.length === 0) {
    throw new Error(`No SQL files were discovered under ${options.directories.join(', ')}`);
  }

  // Build a resolver that honors the configured schema/search path so the generated rows stay canonical.
  const resolver = new TableNameResolver({
    defaultSchema: options.defaultSchema,
    searchPath: options.searchPath
  });

  // Validate the DDL sources up front so fixture metadata is generated from a consistent schema.
  const lintMode = normalizeDdlLintMode(options.ddlLint);
  if (lintMode !== 'off') {
    const diagnostics = lintDdlSources(sources, { tableNameResolver: resolver });
    if (diagnostics.length > 0) {
      const adjusted = applyDdlLintMode(diagnostics, lintMode);
      if (lintMode === 'strict') {
        throw new DdlLintError(adjusted);
      }
      console.warn(formatDdlLintDiagnostics(adjusted));
    }
  }

  const tables = snapshotTableMetadata(sources, resolver);
  if (tables.length === 0) {
    throw new Error('The provided DDL sources did not contain any CREATE TABLE statements.');
  }

  const output = renderZtdConfigFile(tables);
  const manifestOutFile = path.join(path.dirname(options.out), 'ztd-fixture-manifest.generated.ts');
  const manifestOutput = renderZtdFixtureManifestFile(tables);
  if (!options.dryRun) {
    ensureDirectory(path.dirname(options.out));
    writeFileSync(options.out, output, 'utf8');
    writeFileSync(manifestOutFile, manifestOutput, 'utf8');
    console.log(`Generated ${tables.length} ZTD test rows at ${options.out} and ${manifestOutFile}`);
  }
  return {
    tables,
    rendered: output,
    manifestRendered: manifestOutput,
    outFile: options.out,
    manifestOutFile,
    dryRun: Boolean(options.dryRun)
  };
}

export function snapshotTableMetadata(sources: SqlSource[], resolver?: TableNameResolver): TableMetadata[] {
  const registry = new Map<string, TableMetadata>();
  // Track tables by their SQL name so each definition is emitted only once.
  for (const source of sources) {
    // Split multi-statement files so each CREATE TABLE can be processed independently.
    const batch = MultiQuerySplitter.split(source.sql);

    for (const query of batch.queries) {
      if (query.isEmpty) {
        continue;
      }

      let ast: CreateTableQuery | undefined;
      try {
        const parsed = SqlParser.parse(query.sql);
        if (parsed instanceof CreateTableQuery) {
          ast = parsed;
        }
      } catch (_error) {
        continue;
      }

      if (!ast) {
        continue;
      }

      const definition = createTableDefinitionFromCreateTableQuery(ast);

      // Normalize table names so the generated config mirrors resolver expectations.
      const canonicalName = resolver?.resolve(definition.name) ?? definition.name;

      if (registry.has(canonicalName)) {
        continue;
      }

      // Reuse the runtime-ready table definition model so the generated metadata can feed testkit directly.
      const columns = definition.columns.map((column) => ({
        name: column.name,
        typeName: column.typeName,
        isNullable: !column.isNotNull,
        required: Boolean(column.required),
        defaultValue: formatDefaultValue(column.defaultValue),
        isNotNull: Boolean(column.isNotNull)
      }));

      registry.set(canonicalName, {
        name: canonicalName,
        testRowInterfaceName: buildTestRowInterfaceName(canonicalName),
        columns
      });
    }
  }

  return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function formatDefaultValue(value: string | ValueComponent | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    // Render DDL defaults as SQL text so the generated manifest stays readable and deterministic.
    const formatter = new SqlFormatter({ keywordCase: 'none' });
    const { formattedSql } = formatter.format(value);
    return formattedSql;
  } catch (_error) {
    return String(value);
  }
}

function buildTestRowInterfaceName(tableName: string): string {
  // Preserve schema and table segments when Pascal-casing to keep names unique.
  const namespaceParts = tableName.split('.');
  const pascalize = (segment: string): string =>
    segment
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((token) => {
        const lower = token.toLowerCase();
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join('');

  const pascalSegments = namespaceParts.map((segment) => pascalize(segment)).filter(Boolean);
  const combined = pascalSegments.join('');
  const normalized = combined.replace(/^[0-9]+/, '');
  // Guarantee the interface name starts with a letter or underscore.
  const prefix = /^[A-Za-z_]/.test(normalized.charAt(0) ?? '') ? normalized : `_${normalized}`;
  return `${prefix || 'Table'}TestRow`;
}

export function renderZtdConfigFile(tables: TableMetadata[]): string {
  const header = [
    '// GENERATED FILE. DO NOT EDIT.',
    '// ZTD TEST ROW MAP',
    '// This file is synchronized with DDL using ztd-config.',
    '',
    'type ColumnDefinitions = Record<string, string>;',
    '',
    'export interface TableSchemaDefinition {',
    '  columns: ColumnDefinitions;',
    '}',
    '',
    'export type FixtureRow = Record<string, unknown>;',
    '',
    'export interface TableFixture<RowShape extends Record<string, unknown> = FixtureRow> {',
    '  tableName: string;',
    '  rows: RowShape[];',
    '  schema: TableSchemaDefinition;',
    '}',
    ''
  ].join('\n');

  const entries = tables
    .map((table) => `  '${table.name}': ${table.testRowInterfaceName};`)
    .join('\n');

  // Build each table interface while preserving the column order from the DDL.
  const definitions = tables
    .map((table) => {
      const fields = table.columns
        .map((column) => {
          const baseType = mapSqlTypeToTs(column.typeName, `${table.name}.${column.name}`);
          const tsType = column.isNullable ? `${baseType} | null` : baseType;
          return `  ${column.name}: ${tsType};`;
        })
        .join('\n');
      return `export interface ${table.testRowInterfaceName} extends FixtureRow {\n${fields}\n}`;
    })
    .join('\n\n');

  // Assemble a schema map that mirrors TestRowMap so tests can reuse canonical affinity metadata.
  const schemaEntries = tables
    .map((table) => {
      const columnDefinitions = table.columns
        .map((column) => {
          const typeLiteral = JSON.stringify(column.typeName ?? '');
          return `      ${column.name}: ${typeLiteral},`;
        })
        .join('\n');
      return `  '${table.name}': {\n    columns: {\n${columnDefinitions}\n    }\n  },`;
    })
    .join('\n');

  const footer = [
    '',
    'export type TestRow<K extends keyof TestRowMap> = TestRowMap[K];',
    'export type ZtdRowShapes = TestRowMap;',
    'export type ZtdTableName = keyof TestRowMap;',
    '',
    'export type ZtdTableSchemas = Record<ZtdTableName, TableSchemaDefinition>;',
    '',
    'export const tableSchemas: ZtdTableSchemas = {',
    `${schemaEntries}`,
    '};',
    '',
    'export function tableSchema<K extends ZtdTableName>(tableName: K): TableSchemaDefinition {',
    '  return tableSchemas[tableName];',
    '}',
    '',
    'export type ZtdTableFixture<K extends ZtdTableName> = TableFixture<ZtdRowShapes[K]> & {',
    '  tableName: K;',
    '  rows: ZtdRowShapes[K][];',
    '  schema: TableSchemaDefinition;',
    '};',
    '',
    'export interface ZtdConfig {',
    '  tables: ZtdTableName[];',
    '}',
    '',
    'export function tableFixture<K extends ZtdTableName>(',
    '  tableName: K,',
    '  rows: ZtdRowShapes[K][],',
    '  schema?: TableSchemaDefinition',
    '): TableFixture<ZtdRowShapes[K]> {',
    '  return { tableName, rows, schema: schema ?? tableSchemas[tableName] };',
    '}',
    '',
    'export function tableFixtureWithSchema<K extends ZtdTableName>(',
    '  tableName: K,',
    '  rows: ZtdRowShapes[K][]',
    '): ZtdTableFixture<K> {',
    '  // Always pair fixture rows with the canonical schema generated from DDL.',
    '  return { tableName, rows, schema: tableSchemas[tableName] };',
    '}',
    ''
  ].join('\n');

  return `${header}export interface TestRowMap {\n${entries}\n}\n\n${definitions}\n${footer}`;
}

export function renderZtdFixtureManifestFile(tables: TableMetadata[]): string {
  const tableDefinitions = tables
    .map((table) => {
      const columns = table.columns
        .map((column) => {
          const parts = [
            `      name: ${JSON.stringify(column.name)},`,
          ];
          if (column.typeName !== undefined) {
            parts.push(`      typeName: ${JSON.stringify(column.typeName)},`);
          }
          parts.push(`      required: ${column.required},`);
          // The snapshot phase already normalizes DDL defaults, so the renderer only serializes the stable value.
          parts.push(`      defaultValue: ${JSON.stringify(column.defaultValue)},`);
          parts.push(`      isNotNull: ${column.isNotNull},`);
          return [
            '    {',
            ...parts,
            '    },'
          ].join('\n');
        })
        .join('\n');
      return `  {\n    name: ${JSON.stringify(table.name)},\n    columns: [\n${columns}\n    ]\n  },`;
    })
    .join('\n');

  return [
    '// GENERATED FILE. DO NOT EDIT.',
    '// ZTD GENERATED FIXTURE MANIFEST',
    '// This file is synchronized with DDL using ztd-config.',
    '',
    "import type { TableDefinitionModel } from 'rawsql-ts';",
    '',
    'export interface GeneratedFixtureManifest {',
    '  tableDefinitions: TableDefinitionModel[];',
    '}',
    '',
    'export const tableDefinitions: TableDefinitionModel[] = [',
    tableDefinitions,
    '];',
    '',
    'export const generatedFixtureManifest: GeneratedFixtureManifest = {',
    '  tableDefinitions,',
    '};',
    ''
  ].join('\n');
}
