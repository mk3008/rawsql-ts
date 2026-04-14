import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createPostgresTestkitClient, type CreatePostgresTestkitClientOptions, type PostgresTestkitClient } from '@rawsql-ts/testkit-postgres';
import { Pool } from 'pg';

interface StarterProjectConfigFile {
  ztdRootDir?: string;
  ddlDir?: string;
  defaultSchema?: string;
  searchPath?: string[];
}

export interface StarterPostgresDefaults {
  projectRootDir: string;
  defaultSchema: string;
  searchPath: string[];
}

export interface StarterPostgresTestkitOptions<RowType extends Record<string, unknown> = Record<string, unknown>>
  extends Pick<CreatePostgresTestkitClientOptions<RowType>, 'tableDefinitions' | 'tableRows' | 'ddl' | 'onExecute'> {
  rootDir?: string;
  connectionString?: string;
  defaultSchema?: string;
  searchPath?: string[];
}

function normalizeSearchPath(searchPath: unknown): string[] {
  if (!Array.isArray(searchPath)) {
    return [];
  }

  return searchPath.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function loadStarterProjectConfig(rootDir: string = process.cwd()): StarterProjectConfigFile {
  const configPath = path.join(rootDir, 'ztd.config.json');
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as StarterProjectConfigFile;
  } catch (error) {
    if (isMissingConfigFileError(error)) {
      return {};
    }
    throw error;
  }
}

export function loadStarterPostgresDefaults(rootDir: string = process.cwd()): StarterPostgresDefaults {
  const projectConfig = loadStarterProjectConfig(rootDir);
  const resolvedProjectRootDir = path.resolve(rootDir, projectConfig.ztdRootDir ?? '.');
  const defaultSchema =
    typeof projectConfig.defaultSchema === 'string' && projectConfig.defaultSchema.length > 0
      ? projectConfig.defaultSchema
      : 'public';
  const searchPath = normalizeSearchPath(projectConfig.searchPath);

  return {
    projectRootDir: resolvedProjectRootDir,
    defaultSchema,
    searchPath: searchPath.length > 0 ? searchPath : [defaultSchema]
  };
}

/**
 * Create a reusable starter Postgres testkit client for DB-backed smoke tests.
 *
 * Call this helper once per DB context so a workflow can hold multiple clients at the same time.
 *
 * The helper keeps the setup defaults in one place, but leaves table definitions
 * and rows next to the individual test so the sample stays readable.
 */
export function createStarterPostgresTestkitClient<RowType extends Record<string, unknown> = Record<string, unknown>>(
  options: StarterPostgresTestkitOptions<RowType>
): PostgresTestkitClient<RowType> {
  const connectionString = options.connectionString ?? process.env.ZTD_DB_URL;
  if (!connectionString) {
    throw new Error(
      'Set options.connectionString or ZTD_DB_URL before creating a starter Postgres testkit client.'
    );
  }

  const defaults = loadStarterPostgresDefaults(options.rootDir);
  const pool = new Pool({ connectionString });

  return createPostgresTestkitClient({
    queryExecutor: async (sql, params) => {
      const result = await pool.query(sql, params as unknown[]);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? undefined
      };
    },
    defaultSchema: options.defaultSchema ?? defaults.defaultSchema,
    searchPath: options.searchPath ?? defaults.searchPath,
    tableDefinitions: options.tableDefinitions,
    tableRows: options.tableRows,
    ddl: options.ddl ?? resolveStarterDdlOptions(defaults.projectRootDir),
    onExecute: options.onExecute,
    // Let the client own pool shutdown so test cleanup stays a single close() call.
    disposeExecutor: async () => {
      await pool.end();
    }
  });
}

function resolveStarterDdlOptions(projectRootDir: string): CreatePostgresTestkitClientOptions['ddl'] {
  const defaultDdlDirectory = path.join(projectRootDir, 'db', 'ddl');
  if (!existsSync(defaultDdlDirectory)) {
    return undefined;
  }

  return {
    directories: [defaultDdlDirectory]
  };
}

function isMissingConfigFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT';
}
