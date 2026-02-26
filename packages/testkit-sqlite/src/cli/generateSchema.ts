import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { TableSchemaDefinition } from '@rawsql-ts/testkit-core';
import {
  CreateTableQuery,
  SqlParser,
  TypeValue,
  RawString,
  type ParsedStatement,
  type TableColumnDefinition,
} from 'rawsql-ts';

const DEFAULT_OUTPUT = 'schema.json';

interface CliOptions {
  database: string;
  output?: string;
  tables?: string[];
  perTable?: boolean;
}

type SqliteMasterRow = {
  name: string;
  sql: string | null;
};

type BetterSqliteOptions = {
  readonly?: boolean;
  fileMustExist?: boolean;
};

type BetterSqliteConnection = {
  prepare(sql: string): { all(): unknown[] };
  close(): void;
};

type BetterSqliteConstructor = new (filename: string, options?: BetterSqliteOptions) => BetterSqliteConnection;

/**
 * Entry point that parses CLI arguments, builds the SQLite schema map, and writes the output.
 */
async function main(): Promise<void> {
  // Normalize CLI paths to keep behavior consistent regardless of the caller's location.
  const options = parseArgs(process.argv.slice(2));
  const resolvedDatabase = resolve(process.cwd(), options.database);
  const schema = await buildSchema(resolvedDatabase, options.tables);

  if (options.perTable) {
    const outputDir = resolve(process.cwd(), options.output ?? 'schema');
    writeSchemaPerTable(outputDir, schema);
    console.log(`Saved ${Object.keys(schema).length} tables as individual JSON files in ${outputDir}`);
    return;
  }

  const resolvedOutput = resolve(process.cwd(), options.output ?? DEFAULT_OUTPUT);
  writeSchema(resolvedOutput, schema);
  console.log(`Saved schema for ${Object.keys(schema).length} tables to ${resolvedOutput}`);
}

/**
 * Parses the CLI arguments consumed by `pnpm schema:generate`.
 * @param rawArgs - Raw argument tokens provided by the caller.
 * @returns The normalized CLI options object.
 */
function parseArgs(rawArgs: string[]): CliOptions {
  const options: Partial<CliOptions> = {};
  // Walk through the raw arguments and stash values for recognized flags.
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (arg === '--database' || arg === '-d') {
      options.database = rawArgs[++i];
      continue;
    }
    if (arg === '--per-table') {
      options.perTable = true;
      continue;
    }
    if (arg === '--output' || arg === '-o') {
      options.output = rawArgs[++i];
      continue;
    }
    if (arg === '--tables' || arg === '-t') {
      const value = rawArgs[++i];
      options.tables = value
        .split(',')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      continue;
    }
    throw new Error(`Unknown option "${arg}". Run with --help for usage.`);
  }

  if (!options.database) {
    throw new Error('Missing --database argument.');
  }

  return {
    database: options.database,
    output: options.output,
    tables: options.tables,
    perTable: options.perTable,
  };
}

/**
 * Reads CREATE TABLE definitions from the SQLite master table and accumulates parsed column metadata.
 * @param databasePath - Absolute path to the SQLite database file.
 * @param filters - Optional list of lower-cased table names to include.
 * @returns A mapping from normalized table names to schema definitions.
 */
async function buildSchema(databasePath: string, filters?: string[]): Promise<Record<string, TableSchemaDefinition>> {
  // Dynamically import better-sqlite3 so we can surface a clear error when it is missing.
  const betterSqliteModule = await import('better-sqlite3');
  const BetterSqlite = (betterSqliteModule.default ?? betterSqliteModule) as BetterSqliteConstructor;
  const connection = new BetterSqlite(databasePath, { readonly: true, fileMustExist: true });
  const whitelist = filters ? new Set(filters.map((name) => name.toLowerCase())) : null;
  const schema: Record<string, TableSchemaDefinition> = {};

  try {
    const rows = connection
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as SqliteMasterRow[];

    // Iterate through every table definition exposed by sqlite_master.
    for (const row of rows) {
      const normalizedName = row.name.toLowerCase();
      if (whitelist && !whitelist.has(normalizedName)) {
        continue;
      }

      if (!row.sql) {
        // SQLite may omit the CREATE text for virtual or internal structures, so skip those entries.
        console.warn(`Skipping table "${row.name}" because no CREATE statement could be read.`);
        continue;
      }

      try {
        const parsed = SqlParser.parse(row.sql);
        // Guard against other statements so the schema generator stays focused on CREATE TABLE definitions.
        if (!isCreateTableStatement(parsed)) {
          console.warn(`Skipping "${row.name}" because the parser emitted a non-CREATE TABLE statement.`);
          continue;
        }

        const createTable = parsed;
        if (createTable.columns.length === 0) {
          console.warn(`Skipping "${row.name}" because the CREATE TABLE statement does not expose columns.`);
          continue;
        }

        schema[normalizedName] = {
          columns: Object.fromEntries(
            createTable.columns.map((column: TableColumnDefinition) => [
              column.name.name,
              getDeclaredType(column.dataType),
            ])
          ),
        };
      } catch (error) {
        console.warn(`Failed to parse table "${row.name}": ${(error as Error).message}`);
      }
    }
  } finally {
    connection.close();
  }

  if (Object.keys(schema).length === 0) {
    throw new Error('No tables were included in the generated schema.');
  }

  return schema;
}

/**
 * Serializes the schema map to the specified JSON file, sorting the tables for deterministic output.
 * @param outputPath - Destination path for the schema JSON document.
 * @param schema - Table schema definitions to persist.
 */
function writeSchema(outputPath: string, schema: Record<string, TableSchemaDefinition>): void {
  // Sort table entries to keep the generated JSON deterministic.
  const ordered: Record<string, TableSchemaDefinition> = {};
  Object.keys(schema)
    .sort()
    .forEach((name) => {
      ordered[name] = schema[name];
    });

  const directory = dirname(outputPath);
  // Ensure the destination folder exists before writing.
  mkdirSync(directory, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
}

/**
 * Emits one JSON file per table schema so downstream diffs can focus on individual tables.
 * @param directory - Directory to persist the per-table JSON artifacts.
 * @param schema - Table schema definitions to emit individually.
 */
function writeSchemaPerTable(directory: string, schema: Record<string, TableSchemaDefinition>): void {
  mkdirSync(directory, { recursive: true });
  // Persist each table schema inside its own JSON file for easier diffs.
  for (const [tableName, definition] of Object.entries(schema)) {
    const fileName = `${encodeURIComponent(tableName)}.json`;
    const filePath = resolve(directory, fileName);
    writeFileSync(filePath, `${JSON.stringify({ [tableName]: definition }, null, 2)}\n`, 'utf8');
  }
}

/**
 * Guards on CREATE TABLE statements and filters out any other parsed SQL nodes.
 * @param statement - The AST node emitted by the parser.
 */
function isCreateTableStatement(statement: ParsedStatement): statement is CreateTableQuery {
  return statement.getKind() === CreateTableQuery.kind;
}

/**
 * Retrieves the declared type name from the parser metadata, falling back to literal tokens when necessary.
 * @param dataType - AST node describing the column's declared type.
 * @returns The original type text or an empty string when unavailable.
 */
function getDeclaredType(dataType?: TypeValue | RawString | null): string {
  if (!dataType) {
    return '';
  }

  // Prefer the parser's helper when it exposes the declarative type text.
  if ('getTypeName' in dataType && typeof dataType.getTypeName === 'function') {
    return dataType.getTypeName().trim();
  }

  // Fall back to direct literal values for simple AST nodes.
  if ('value' in dataType && typeof dataType.value === 'string') {
    return dataType.value.trim();
  }

  return '';
}

/**
 * Prints the human-friendly CLI usage instructions and exits the process.
 */
function printUsage(): void {
  console.log(`
Usage:
  pnpm --filter @rawsql-ts/testkit-sqlite run schema:generate -- --database <path> [--output <path>] [--tables <names>]

Options:
  --per-table                Emit per-table JSON files instead of a single schema.json (output path becomes a directory).
    --database, -d <path>      SQLite database file that hosts the CREATE TABLE statements.
    --output, -o <path>        Path to write schema.json (defaults to schema.json in the current directory).
    --tables, -t <names>       Comma-separated list of table names to include (case-insensitive).
    --help, -h                 Show this message.
  `);
}

void main().catch((error) => {
  console.error('Schema generation failed:', (error as Error).message);
  process.exitCode = 1;
});
