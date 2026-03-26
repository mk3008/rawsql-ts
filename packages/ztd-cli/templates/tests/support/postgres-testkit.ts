import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createPostgresTestkitClient, type CreatePostgresTestkitClientOptions, type PostgresTestkitClient } from '@rawsql-ts/testkit-postgres';
import { Pool } from 'pg';

interface StarterProjectConfigFile {
  ztdRootDir?: string;
  ddlDir?: string;
  defaultSchema?: string;
  searchPath?: string[];
  ddl?: {
    defaultSchema?: string;
    searchPath?: string[];
  };
}

export interface StarterPostgresDefaults {
  projectRootDir: string;
  defaultSchema: string;
  searchPath: string[];
}

export interface StarterPostgresTestkitOptions<RowType extends Record<string, unknown> = Record<string, unknown>>
  extends Pick<CreatePostgresTestkitClientOptions<RowType>, 'tableDefinitions' | 'tableRows'> {
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
  const resolvedDdl = typeof projectConfig.ddl === 'object' && projectConfig.ddl !== null ? projectConfig.ddl : undefined;
  // Prefer top-level config defaults first, then fall back to the legacy ddl block.
  const defaultSchema =
    typeof projectConfig.defaultSchema === 'string' && projectConfig.defaultSchema.length > 0
      ? projectConfig.defaultSchema
      : typeof resolvedDdl?.defaultSchema === 'string' && resolvedDdl.defaultSchema.length > 0
        ? resolvedDdl.defaultSchema
        : 'public';
  const searchPath = normalizeSearchPath(projectConfig.searchPath ?? resolvedDdl?.searchPath);

  return {
    projectRootDir: resolvedProjectRootDir,
    defaultSchema,
    searchPath: searchPath.length > 0 ? searchPath : [defaultSchema]
  };
}

/**
 * Create a reusable starter Postgres testkit client for DB-backed smoke tests.
 *
 * The helper keeps the setup defaults in one place, but leaves table definitions
 * and rows next to the individual test so the sample stays readable.
 */
export function createStarterPostgresTestkitClient<RowType extends Record<string, unknown> = Record<string, unknown>>(
  options: StarterPostgresTestkitOptions<RowType>
): PostgresTestkitClient<RowType> {
  const connectionString = options.connectionString ?? process.env.ZTD_TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Set options.connectionString or ZTD_TEST_DATABASE_URL before creating a starter Postgres testkit client.'
    );
  }

  const defaults = loadStarterPostgresDefaults(options.rootDir);
  const pool = new Pool({ connectionString });

  return createPostgresTestkitClient({
    queryExecutor: (sql, params) => pool.query(sql, params as unknown[]),
    defaultSchema: options.defaultSchema ?? defaults.defaultSchema,
    searchPath: options.searchPath ?? defaults.searchPath,
    tableDefinitions: options.tableDefinitions,
    tableRows: options.tableRows,
    // Let the client own pool shutdown so test cleanup stays a single close() call.
    disposeExecutor: async () => {
      await pool.end();
    }
  });
}

function isMissingConfigFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT';
}
