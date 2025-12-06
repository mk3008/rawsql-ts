import { writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  createTableDefinitionFromCreateTableQuery,
  CreateTableQuery,
  MultiQuerySplitter,
  SqlParser
} from 'rawsql-ts';
import { collectSqlFiles, SqlSource } from '../utils/collectSqlFiles';
import { mapSqlTypeToTs } from '../utils/typeMapper';
import { ensureDirectory } from '../utils/fs';

export interface ZtdConfigGenerationOptions {
  directories: string[];
  extensions: string[];
  out: string;
}

export interface ColumnMetadata {
  name: string;
  typeName?: string;
  isNullable: boolean;
}

export interface TableMetadata {
  name: string;
  testRowInterfaceName: string;
  columns: ColumnMetadata[];
}

export function runGenerateZtdConfig(options: ZtdConfigGenerationOptions): void {
  const sources = collectSqlFiles(options.directories, options.extensions);
  if (sources.length === 0) {
    throw new Error(`No SQL files were discovered under ${options.directories.join(', ')}`);
  }

  const tables = snapshotTableMetadata(sources);
  if (tables.length === 0) {
    throw new Error('The provided DDL sources did not contain any CREATE TABLE statements.');
  }

  const output = renderZtdConfigFile(tables);
  ensureDirectory(path.dirname(options.out));
  writeFileSync(options.out, output, 'utf8');
  console.log(`Generated ${tables.length} ZTD test rows at ${options.out}`);
}

export function snapshotTableMetadata(sources: SqlSource[]): TableMetadata[] {
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

      if (registry.has(definition.name)) {
        continue;
      }

      // Match column metadata by name so AST-driven nullability honors both DDL and constraints.
      const columns = ast.columns.map((column) => {
        const columnMeta = definition.columns.find((candidate) => candidate.name === column.name.name);
        if (!columnMeta) {
          throw new Error(`Missing metadata for ${column.name.name} in ${definition.name}`);
        }
        const constraintKinds = new Set(column.constraints.map((constraint) => constraint.kind));
        const hasNotNull = constraintKinds.has('not-null') || constraintKinds.has('primary-key');

        return {
          name: column.name.name,
          typeName: columnMeta.typeName,
          isNullable: !hasNotNull
        };
      });

      registry.set(definition.name, {
        name: definition.name,
        testRowInterfaceName: buildTestRowInterfaceName(definition.name),
        columns
      });
    }
  }

  return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
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
    '// ZTD TEST ROW MAP - AUTO GENERATED',
    '// Tests must import TestRowMap from this file and never from src.',
    '// This file is synchronized with DDL using ztd-config.',
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
      return `export interface ${table.testRowInterfaceName} {\n${fields}\n}`;
    })
    .join('\n\n');

  const footer = [
    '',
    'export type TestRow<K extends keyof TestRowMap> = TestRowMap[K];',
    'export type ZtdTableName = keyof TestRowMap;',
    ''
  ].join('\n');

  return `${header}export interface TestRowMap {\n${entries}\n}\n\n${definitions}\n${footer}`;
}
