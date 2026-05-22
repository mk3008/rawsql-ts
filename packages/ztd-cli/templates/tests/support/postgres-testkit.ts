import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  createPostgresTestkitClient,
  type CreatePostgresTestkitClientOptions,
  type PostgresTestkitClient
} from '@rawsql-ts/testkit-postgres';
import type { DdlFixtureLoaderOptions } from '@rawsql-ts/testkit-core';
import { Pool } from 'pg';

interface StarterProjectConfigFile {
  ztdRootDir?: string;
  ddlDir?: string;
  defaultSchema?: string;
  searchPath?: string[];
}

export interface StarterPostgresDefaults {
  projectRootDir: string;
  ztdRootDir: string;
  defaultSchema: string;
  searchPath: string[];
  ddlDirectories: string[];
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

  return searchPath
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
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
  const resolvedProjectRootDir = path.resolve(rootDir);
  const resolvedZtdRootDir = path.resolve(rootDir, projectConfig.ztdRootDir ?? '.ztd');
  const configuredDefaultSchema =
    typeof projectConfig.defaultSchema === 'string' ? projectConfig.defaultSchema.trim() : '';
  const defaultSchema = configuredDefaultSchema.length > 0 ? configuredDefaultSchema : 'public';
  const searchPath = normalizeSearchPath(projectConfig.searchPath);
  const resolvedDdlDir = path.resolve(
    resolvedProjectRootDir,
    typeof projectConfig.ddlDir === 'string' && projectConfig.ddlDir.trim().length > 0
      ? projectConfig.ddlDir
      : 'db/ddl'
  );

  return {
    projectRootDir: resolvedProjectRootDir,
    ztdRootDir: resolvedZtdRootDir,
    defaultSchema,
    searchPath: searchPath.length > 0 ? searchPath : [defaultSchema],
    ddlDirectories: existsSync(resolvedDdlDir) ? [resolvedDdlDir] : []
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
    throw new Error(buildStarterPostgresSetupMessage());
  }

  const defaults = loadStarterPostgresDefaults(options.rootDir);
  const pool = new Pool({ connectionString });

  return createPostgresTestkitClient({
    queryExecutor: async (sql, params) => {
      try {
        const result = await pool.query(sql, params as unknown[]);
        return {
          rows: result.rows,
          rowCount: result.rowCount ?? undefined
        };
      } catch (error) {
        throw wrapStarterPostgresFailureIfHelpful(error, connectionString);
      }
    },
    defaultSchema: options.defaultSchema ?? defaults.defaultSchema,
    searchPath: options.searchPath ?? defaults.searchPath,
    tableDefinitions: options.tableDefinitions,
    tableRows: options.tableRows,
    ddl: options.ddl ?? resolveStarterDdlOptions(defaults.ddlDirectories),
    onExecute: options.onExecute,
    // Let the client own pool shutdown so test cleanup stays a single close() call.
    disposeExecutor: async () => {
      await pool.end();
    }
  });
}

function buildStarterPostgresSetupMessage(): string {
  return [
    'ZTD_DB_URL is not set before creating a starter Postgres testkit client.',
    '',
    'Next steps:',
    '1. Copy `.env.example` to `.env`.',
    '2. Set `ZTD_DB_PORT=5432`, or choose another free host port.',
    '3. Start the starter Postgres database with `docker compose up -d`.',
    '4. Rerun `npx vitest run`.',
    '',
    'The generated Vitest setup derives `ZTD_DB_URL` from `ZTD_DB_PORT`.',
    'If Docker reports `all predefined address pools have been fully subnetted`, fix Docker networking first; changing `ZTD_DB_PORT` alone will not recover that error.'
  ].join('\n');
}

function wrapStarterPostgresFailureIfHelpful(error: unknown, connectionString: string): unknown {
  if (!isStarterPostgresConnectionFailure(error)) {
    return error;
  }

  const originalMessage = error instanceof Error ? error.message : String(error);
  const wrapped = new Error(
    [
      'The starter Postgres database was not reachable while running a starter Postgres testkit query.',
      '',
      `Connection target: ${describeConnectionTarget(connectionString)}`,
      `Original error: ${originalMessage}`,
      '',
      'Next steps:',
      '1. Start the bundled database with `docker compose up -d`.',
      '2. If port 5432 is already in use, set another `ZTD_DB_PORT` in `.env` and rerun `docker compose up -d`.',
      '3. Wait until Postgres is ready, then rerun `npx vitest run`.',
      '',
      'If Docker reports `all predefined address pools have been fully subnetted`, fix Docker networking first; changing `ZTD_DB_PORT` alone will not recover that error.'
    ].join('\n')
  );
  (wrapped as Error & { cause?: unknown }).cause = error;
  return wrapped;
}

function isStarterPostgresConnectionFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', '28P01', '3D000'].includes(code)) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /connection terminated|connection timeout|password authentication failed|getaddrinfo|connect econnrefused/i.test(message);
}

function describeConnectionTarget(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}/${url.pathname.replace(/^\/+/, '')}`;
  } catch {
    return 'configured ZTD_DB_URL';
  }
}

function resolveStarterDdlOptions(ddlDirectories: string[]): DdlFixtureLoaderOptions | undefined {
  if (ddlDirectories.length === 0) {
    return undefined;
  }

  return {
    directories: ddlDirectories
  };
}

function isMissingConfigFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT';
}
