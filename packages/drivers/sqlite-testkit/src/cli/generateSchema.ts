import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { TableSchemaDefinition, SqliteAffinity } from '@rawsql-ts/testkit-core';
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
              mapDeclaredTypeToAffinity(getDeclaredType(column.dataType)),
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

function writeSchemaPerTable(directory: string, schema: Record<string, TableSchemaDefinition>): void {
  mkdirSync(directory, { recursive: true });
  // Persist each table schema inside its own JSON file for easier diffs.
  for (const [tableName, definition] of Object.entries(schema)) {
    const fileName = `${encodeURIComponent(tableName)}.json`;
    const filePath = resolve(directory, fileName);
    writeFileSync(filePath, `${JSON.stringify({ [tableName]: definition }, null, 2)}\n`, 'utf8');
  }
}

function isCreateTableStatement(statement: ParsedStatement): statement is CreateTableQuery {
  return statement.getKind() === CreateTableQuery.kind;
}

function getDeclaredType(dataType?: TypeValue | RawString | null): string {
  if (!dataType) {
    return '';
  }
  if ('getTypeName' in dataType && typeof dataType.getTypeName === 'function') {
    return dataType.getTypeName();
  }
  if ('value' in dataType && typeof dataType.value === 'string') {
    return dataType.value;
  }
  return '';
}

function mapDeclaredTypeToAffinity(typeName: string): SqliteAffinity {
  const normalized = typeName.trim().toUpperCase();
  // Apply SQLite affinity precedence rules derived from official documentation.
  if (normalized === '' || normalized.includes('BLOB')) {
    return 'BLOB';
  }
  if (normalized.includes('INT')) {
    return 'INTEGER';
  }
  if (normalized.includes('CHAR') || normalized.includes('CLOB') || normalized.includes('TEXT')) {
    return 'TEXT';
  }
  if (normalized.includes('REAL') || normalized.includes('FLOA') || normalized.includes('DOUB')) {
    return 'REAL';
  }
  return 'NUMERIC';
}

function printUsage(): void {
  console.log(`
Usage:
  pnpm --filter @rawsql-ts/sqlite-testkit run schema:generate -- --database <path> [--output <path>] [--tables ts]

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
