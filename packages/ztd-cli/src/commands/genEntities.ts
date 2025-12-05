import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { collectSqlFiles } from '../utils/collectSqlFiles';
import { ensureDirectory } from '../utils/fs';
import { mapSqlTypeToTs } from '../utils/typeMapper';
import { snapshotTableMetadata, type TableMetadata } from './ztdConfig';

export interface GenerateEntitiesOptions {
  directories: string[];
  extensions: string[];
  out: string;
}

export function runGenerateEntities(options: GenerateEntitiesOptions): void {
  const sources = collectSqlFiles(options.directories, options.extensions);
  if (sources.length === 0) {
    throw new Error(`No SQL files were discovered under ${options.directories.join(', ')}`);
  }

  const tables = snapshotTableMetadata(sources);
  if (tables.length === 0) {
    throw new Error('The provided DDL sources did not contain any CREATE TABLE statements.');
  }

  const output = renderEntitiesFile(tables);
  ensureDirectory(path.dirname(options.out));
  writeFileSync(options.out, output, 'utf8');
  console.log(`Generated ${tables.length} schema helpers at ${options.out}`);
}

function renderEntitiesFile(tables: TableMetadata[]): string {
  // The header reminds maintainers that this file is a secondary reference next to tests/ztd-config.ts.
  const header = [
    '// ENTITY HELPERS - AUTO GENERATED',
    '// Complementary reference for tooling. TestRowMap in tests/ztd-config.ts remains authoritative.',
    ''
  ].join('\n');

  // Emit an interface per table to keep column metadata available for optional helpers.
  const definitions = tables
    .map((table) => {
      const entityName = table.testRowInterfaceName.replace(/TestRow$/, 'Entity');
      const fields = table.columns
        .map((column) => {
          const baseType = mapSqlTypeToTs(column.typeName, `${table.name}.${column.name}`);
          const tsType = column.isNullable ? `${baseType} | null` : baseType;
          return `  ${column.name}: ${tsType};`;
        })
        .join('\n');
      return `export interface ${entityName} {\n${fields}\n}`;
    })
    .join('\n\n');

  return `${header}${definitions}\n`;
}
