import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DdlLintMode } from '@rawsql-ts/testkit-core';

export interface ZtdConnectionConfig {
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

export interface ZtdProjectConfig {
  ztdRootDir?: string;
  dialect: string;
  ddlDir: string;
  testsDir: string;
  defaultSchema: string;
  searchPath: string[];
  /** Controls DDL integrity validation during config generation and tests. */
  ddlLint: DdlLintMode;
  /** @deprecated Legacy field. ztd-cli no longer uses config-based DB connections implicitly. */
  connection?: ZtdConnectionConfig;
}

const CONFIG_NAME = 'ztd.config.json';

let hasWarnedLegacyConnectionConfig = false;

export const DEFAULT_ZTD_CONFIG: ZtdProjectConfig = {
  dialect: 'postgres',
  ddlDir: 'ztd/ddl',
  testsDir: 'tests',
  defaultSchema: 'public',
  searchPath: ['public'],
  ddlLint: 'strict'
};

/**
 * Resolves the path to the project's ztd.config.json from a provided root.
 * @param rootDir - Directory to start searching from (defaults to current working directory).
 * @returns Absolute path to ztd.config.json.
 */
export function resolveZtdConfigPath(rootDir: string = process.cwd()): string {
  return path.join(rootDir, CONFIG_NAME);
}

/**
 * Loads the project configuration, merging against defaults when the file is missing or partially provided.
 * @param rootDir - Directory containing the ztd.config.json file.
 * @returns A fully-resolved ZtdProjectConfig instance.
 */
export function loadZtdProjectConfig(rootDir: string = process.cwd()): ZtdProjectConfig {
  const filePath = resolveZtdConfigPath(rootDir);
  if (!existsSync(filePath)) {
    return DEFAULT_ZTD_CONFIG;
  }

  try {
    // Merge on top of defaults so partial configs remain valid.
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const rawConnection = typeof raw.connection === 'object' && raw.connection !== null ? raw.connection : undefined;
    const rawLintMode = typeof raw.ddlLint === 'string' ? raw.ddlLint.trim().toLowerCase() : undefined;
    const resolvedDefaultSchema = resolveSchemaName(
      typeof raw.defaultSchema === 'string' ? raw.defaultSchema : undefined,
      DEFAULT_ZTD_CONFIG.defaultSchema
    );
    const resolvedSearchPath = resolveSearchPath(
      raw.searchPath,
      undefined,
      resolvedDefaultSchema
    );
    const normalizedConnection = normalizeConnectionConfig(rawConnection);
    if (normalizedConnection) {
      emitLegacyConnectionConfigWarning(filePath);
    }

    return {
      ztdRootDir: typeof raw.ztdRootDir === 'string' && raw.ztdRootDir.length ? raw.ztdRootDir : undefined,
      dialect: typeof raw.dialect === 'string' ? raw.dialect : DEFAULT_ZTD_CONFIG.dialect,
      ddlDir: typeof raw.ddlDir === 'string' && raw.ddlDir.length ? raw.ddlDir : DEFAULT_ZTD_CONFIG.ddlDir,
      testsDir:
        typeof raw.testsDir === 'string' && raw.testsDir.length ? raw.testsDir : DEFAULT_ZTD_CONFIG.testsDir,
      defaultSchema: resolvedDefaultSchema,
      searchPath: resolvedSearchPath,
      ddlLint: isDdlLintMode(rawLintMode) ? rawLintMode : DEFAULT_ZTD_CONFIG.ddlLint,
      connection: normalizedConnection
    };
  } catch (error) {
    throw new Error(`${CONFIG_NAME} is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isDdlLintMode(value?: string): value is DdlLintMode {
  return value === 'strict' || value === 'warn' || value === 'off';
}

function resolveSchemaName(primary?: string, fallback?: string, defaultValue = DEFAULT_ZTD_CONFIG.defaultSchema): string {
  const candidate = [primary, fallback].find((value): value is string => typeof value === 'string' && value.length > 0);
  return candidate ?? defaultValue;
}

function resolveSearchPath(
  primary: unknown,
  fallback: unknown,
  defaultSchema: string
): string[] {
  const primaryPath = normalizeSchemaList(primary);
  if (primaryPath.length > 0) {
    return primaryPath;
  }

  const fallbackPath = normalizeSchemaList(fallback);
  if (fallbackPath.length > 0) {
    return fallbackPath;
  }

  return [defaultSchema];
}

function normalizeSchemaList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

/**
 * Persists the provided overrides on top of the existing project configuration.
 * @param rootDir - Directory that hosts ztd.config.json.
 * @param overrides - Partial configuration values to merge.
 */
export function writeZtdProjectConfig(
  rootDir: string,
  overrides: Partial<ZtdProjectConfig> = {},
  baseConfig: ZtdProjectConfig = loadZtdProjectConfig(rootDir)
): boolean {
  const finalConfig = mergeProjectConfig(baseConfig, overrides);
  const existingPath = resolveZtdConfigPath(rootDir);
  const existingConfigPresent = existsSync(existingPath);
  const baseSerialized = `${JSON.stringify(baseConfig, null, 2)}\n`;
  const finalSerialized = `${JSON.stringify(finalConfig, null, 2)}\n`;
  if (existingConfigPresent && baseSerialized === finalSerialized) {
    return false;
  }

  const resolvedConnection = mergeConnectionConfig(baseConfig.connection, overrides.connection);
  if (resolvedConnection) {
    finalConfig.connection = resolvedConnection;
  } else {
    delete finalConfig.connection;
  }

  writeFileSync(existingPath, `${JSON.stringify(finalConfig, null, 2)}\n`, 'utf8');
  return true;
}

/**
 * Normalizes a raw connection object into the typed connection configuration.
 * @param rawConnection - Value read from ztd.config.json that may describe a connection.
 * @returns A typed connection config or undefined when the input is invalid.
 */
function normalizeConnectionConfig(rawConnection: unknown): ZtdConnectionConfig | undefined {
  if (typeof rawConnection !== 'object' || rawConnection === null) {
    return undefined;
  }
  const rawRecord = rawConnection as Record<string, unknown>;
  const connection: ZtdConnectionConfig = {};
  const url = typeof rawRecord.url === 'string' ? rawRecord.url.trim() : undefined;
  if (url) {
    connection.url = url;
  }

  const host = typeof rawRecord.host === 'string' ? rawRecord.host.trim() : undefined;
  if (host) {
    connection.host = host;
  }

  const user = typeof rawRecord.user === 'string' ? rawRecord.user.trim() : undefined;
  if (user) {
    connection.user = user;
  }

  const password =
    typeof rawRecord.password === 'string' && rawRecord.password.length > 0 ? rawRecord.password : undefined;
  if (password) {
    connection.password = password;
  }

  const database = typeof rawRecord.database === 'string' ? rawRecord.database.trim() : undefined;
  if (database) {
    connection.database = database;
  }

  const portValue = rawRecord.port;
  const port = typeof portValue === 'number'
    ? portValue
    : typeof portValue === 'string'
      ? Number(portValue)
      : undefined;
  if (port && Number.isInteger(port) && port > 0) {
    connection.port = port;
  }

  if (Object.keys(connection).length === 0) {
    return undefined;
  }

  return connection;
}

/**
 * Merges two connection config objects, preferring values from the overrides.
 * @param base - Existing connection configuration.
 * @param overrides - Incoming override values from CLI or other sources.
 * @returns Combined configuration or undefined when nothing is specified.
 */
function mergeConnectionConfig(
  base?: ZtdConnectionConfig,
  overrides?: ZtdConnectionConfig
): ZtdConnectionConfig | undefined {
  const merged: ZtdConnectionConfig = {
    ...(base ?? {}),
    ...(overrides ?? {})
  };

  if (Object.keys(merged).length === 0) {
    return undefined;
  }

  return merged;
}

function mergeProjectConfig(
  baseConfig: ZtdProjectConfig,
  overrides: Partial<ZtdProjectConfig>
): ZtdProjectConfig {
  const defaultSchema =
    typeof overrides.defaultSchema === 'string' && overrides.defaultSchema.length > 0
      ? overrides.defaultSchema
      : baseConfig.defaultSchema;
  const searchPath =
    normalizeSchemaList(overrides.searchPath).length > 0
      ? normalizeSchemaList(overrides.searchPath)
      : baseConfig.searchPath;
  return {
    ...baseConfig,
    ...overrides,
    defaultSchema,
    searchPath
  };
}

function emitLegacyConnectionConfigWarning(filePath: string): void {
  if (hasWarnedLegacyConnectionConfig) {
    return;
  }

  hasWarnedLegacyConnectionConfig = true;
  process.emitWarning(
    `Legacy connection settings were found in ${filePath}. ztd-cli no longer uses ztd.config.json.connection for implicit DB resolution. Use ZTD_TEST_DATABASE_URL for ZTD-owned workflows and pass --url or --db-* explicitly for non-ZTD targets.`,
    {
      code: 'ZTD_LEGACY_CONNECTION_CONFIG',
      detail: 'The connection field remains readable for compatibility, but it is deprecated.'
    }
  );
}
