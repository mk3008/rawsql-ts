import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { createTableDefinitionFromCreateTableQuery, CreateTableQuery, MultiQuerySplitter, SqlParser } from 'rawsql-ts';
import { collectSqlFiles, SqlSource } from '../utils/collectSqlFiles';
import { mapSqlTypeToTs } from '../utils/typeMapper';
import { ensureDirectory } from '../utils/fs';

interface GenEntitiesOptions {
  directories: string[];
  extensions: string[];
  out: string;
}

interface ColumnMetadata {
  name: string;
  typeName?: string;
  isNullable: boolean;
}

interface TableMetadata {
  name: string;
  interfaceName: string;
  columns: ColumnMetadata[];
}

export function runGenerateEntities(options: GenEntitiesOptions): void {
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
  console.log(`Generated ${tables.length} entity interfaces at ${options.out}`);
}

/**
 * Capture metadata from every CREATE TABLE statement so entity sources can be rendered deterministically.
 * The rawsql AST supports optional clauses such as IF NOT EXISTS or UNLOGGED, so those forms still yield CreateTableQuery instances.
 */
export function snapshotTableMetadata(sources: SqlSource[]): TableMetadata[] {
  // Track tables by their SQL name to avoid duplicate definitions.
  const registry = new Map<string, TableMetadata>();

  for (const source of sources) {
    // Iterate through every SQL statement to capture CREATE TABLE declarations.
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
        // Ignore parse failures so a single bad statement does not halt the CLI run.
        continue;
      }

      if (!ast) {
        continue;
      }

      const definition = createTableDefinitionFromCreateTableQuery(ast);

      // Avoid reprocessing a table that was already captured in this run.
      if (registry.has(definition.name)) {
        continue;
      }
      // Collect column metadata while honoring NOT NULL/PRIMARY KEY hints.
      const columns = ast.columns.map((column) => {
        // Match column metadata by name rather than by ordinal to avoid misalignment between AST and TableDefinition.
        const columnMeta = definition.columns.find((candidate) => candidate.name === column.name.name);
        if (!columnMeta) {
          // Fail fast so we never emit an interface that lacks schema metadata.
          throw new Error(`Missing metadata for ${column.name.name} in ${definition.name}`);
        }
        const constraintKinds = new Set(column.constraints.map((constraint) => constraint.kind));
        const hasNotNull =
          columnMeta.isNotNull || constraintKinds.has('not-null') || constraintKinds.has('primary-key');

        return {
          name: column.name.name,
          typeName: columnMeta.typeName,
          isNullable: !hasNotNull
        };
      });
      // The column iteration order honors the DDL order so generated interfaces stay deterministic.

      registry.set(definition.name, {
        name: definition.name,
        interfaceName: buildInterfaceName(definition.name),
        columns
      });
    }
  }

  return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function buildInterfaceName(tableName: string): string {
  // Split schema and table portions before applying PascalCase so each part remains distinguishable.
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
  // Guarantee the name starts with an alphabetic character or underscore.
  const prefix = /^[A-Za-z_]/.test(normalized.charAt(0) ?? '') ? normalized : `_${normalized}`;
  return `${prefix || 'Table'}Entity`;
}

/**
 * Emit the TypeScript module that declares both the Entities map and each table row interface.
 */
export function renderEntitiesFile(tables: TableMetadata[]): string {
  // Provide a consistent header so generated files can be traced back to the CLI tool.
  const header = '// Generated by rawsql ddl gen-entities. Do not edit manually.\n\n';
  // Build the Entities interface so tests can reference tables via their SQL names.
  const entries = tables
    .map((table) => `  '${table.name}': ${table.interfaceName};`)
    .join('\n');

  // Emit each table row interface using the collected column metadata.
  // Tables are sorted by their SQL name and columns follow the original DDL order.
  const definitions = tables
    .map((table) => {
      const fields = table.columns
        .map((column) => {
          const baseType = mapSqlTypeToTs(column.typeName, `${table.name}.${column.name}`);
          const tsType = column.isNullable ? `${baseType} | null` : baseType;
          return `  ${column.name}: ${tsType};`;
        })
        .join('\n');

      return `export interface ${table.interfaceName} {\n${fields}\n}`;
    })
    .join('\n\n');

  // Always end the generated module with exactly one newline for stability.
  const trailingNewline = '\n';
  return `${header}export interface Entities {\n${entries}\n}\n\n${definitions}${trailingNewline}`;
}
