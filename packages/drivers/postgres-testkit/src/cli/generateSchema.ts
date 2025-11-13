import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Client } from 'pg';
import type { TableSchemaDefinition } from '@rawsql-ts/testkit-core';

const DEFAULT_OUTPUT = 'postgres-schema.json';

interface CliOptions {
  connection?: string;
  output?: string;
  tables?: string[];
  perTable?: boolean;
}

type ColumnMetadata = {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const connectionString = options.connection ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Provide a Postgres connection string via --connection or the DATABASE_URL env var.');
  }

  const schema = await buildSchema(connectionString, options.tables);
  if (options.perTable) {
    const outputDir = resolve(process.cwd(), options.output ?? 'schema');
    writeSchemaPerTable(outputDir, schema);
    console.log(`Saved ${Object.keys(schema).length} tables as individual JSON files in ${outputDir}`);
    return;
  }

  const outputPath = resolve(process.cwd(), options.output ?? DEFAULT_OUTPUT);
  writeSchema(outputPath, schema);
  console.log(`Saved schema for ${Object.keys(schema).length} tables to ${outputPath}`);
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (arg === '--connection' || arg === '-c') {
      options.connection = rawArgs[++i];
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
    if (arg === '--per-table') {
      options.perTable = true;
      continue;
    }
    throw new Error(`Unknown option "${arg}". Run with --help for usage.`);
  }

  return options;
}

export async function buildSchema(
  connectionString: string,
  filters?: string[]
): Promise<Record<string, TableSchemaDefinition>> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const queryText = `
      SELECT table_schema, table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name, ordinal_position
    `;
    const result = await client.query<ColumnMetadata>(queryText);
    const schema = buildSchemaFromMetadata(result.rows, filters);
    if (Object.keys(schema).length === 0) {
      throw new Error('No tables were included in the generated schema.');
    }
    return schema;
  } finally {
    await client.end();
  }
}

export function buildSchemaFromMetadata(
  rows: ColumnMetadata[],
  filters?: string[]
): Record<string, TableSchemaDefinition> {
  const schema: Record<string, TableSchemaDefinition> = {};
  const predicate = createFilterPredicate(filters);

  for (const row of rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!predicate(key)) {
      continue;
    }

    const entry = schema[key] ?? { columns: {} };
    entry.columns[row.column_name] = row.data_type;
    schema[key] = entry;
  }

  return schema;
}

function createFilterPredicate(filters?: string[]): (key: string) => boolean {
  if (!filters || filters.length === 0) {
    return () => true;
  }

  const normalizedFilters = filters
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  const schemaFilters = new Set<string>();
  const tableFilters = new Set<string>();

  for (const value of normalizedFilters) {
    if (value.includes('.')) {
      schemaFilters.add(value);
    } else {
      tableFilters.add(value);
    }
  }

  return (key: string) => {
    const normalizedKey = key.toLowerCase();
    if (schemaFilters.has(normalizedKey)) {
      return true;
    }
    if (tableFilters.size === 0) {
      return false;
    }
    const tableName = normalizedKey.split('.').pop() ?? normalizedKey;
    return tableFilters.has(tableName);
  };
}

function writeSchema(outputPath: string, schema: Record<string, TableSchemaDefinition>): void {
  const ordered: Record<string, TableSchemaDefinition> = {};
  Object.keys(schema)
    .sort()
    .forEach((name) => {
      ordered[name] = schema[name];
    });

  const directory = dirname(outputPath);
  mkdirSync(directory, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(ordered, null, 2)}
`, 'utf8');
}

function writeSchemaPerTable(directory: string, schema: Record<string, TableSchemaDefinition>): void {
  mkdirSync(directory, { recursive: true });
  for (const [tableName, definition] of Object.entries(schema)) {
    const fileName = `${encodeURIComponent(tableName)}.json`;
    const filePath = resolve(directory, fileName);
    writeFileSync(filePath, `${JSON.stringify({ [tableName]: definition }, null, 2)}
`, 'utf8');
  }
}

function printUsage(): void {
  console.log(`
Usage:
  pnpm --filter @rawsql-ts/postgres-testkit run schema:generate -- --connection <url> [--output <path>] [--tables names] [--per-table]

Options:
    --connection, -c <url>  Postgres connection string or DSN (or set DATABASE_URL).
    --output, -o <path>     Path to write schema JSON (defaults to postgres-schema.json).
    --tables, -t <names>    Comma-separated list of schema.table selections (case-insensitive).
    --per-table             Emit each table schema as its own JSON file.
    --help, -h              Show this message.
  `);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Schema generation failed:', (error as Error).message);
    process.exitCode = 1;
  });
}
