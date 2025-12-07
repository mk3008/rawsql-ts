import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface ZtdConnectionConfig {
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

export interface ZtdProjectConfig {
  dialect: string;
  ddlDir: string;
  testsDir: string;
  ddl: {
    defaultSchema: string;
    searchPath: string[];
  };
  connection?: ZtdConnectionConfig;
}

const CONFIG_NAME = 'ztd.config.json';

const DEFAULT_DDL_PROPERTIES = {
  defaultSchema: 'public',
  searchPath: ['public']
};

export const DEFAULT_ZTD_CONFIG: ZtdProjectConfig = {
  dialect: 'postgres',
  ddlDir: 'ddl',
  testsDir: 'tests',
  ddl: { ...DEFAULT_DDL_PROPERTIES }
};

export function resolveZtdConfigPath(rootDir: string = process.cwd()): string {
  return path.join(rootDir, CONFIG_NAME);
}

export function loadZtdProjectConfig(rootDir: string = process.cwd()): ZtdProjectConfig {
  const filePath = resolveZtdConfigPath(rootDir);
  if (!existsSync(filePath)) {
    return DEFAULT_ZTD_CONFIG;
  }

  try {
    // Merge on top of defaults so partial configs remain valid.
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const rawDdl = typeof raw.ddl === 'object' && raw.ddl !== null ? raw.ddl : undefined;
    const rawConnection = typeof raw.connection === 'object' && raw.connection !== null ? raw.connection : undefined;
    // Treat only non-empty ddl.searchPath arrays as explicit overrides.
    const rawSearchPath = Array.isArray(rawDdl?.searchPath) ? rawDdl.searchPath : undefined;
    // Detect override intent only when a non-empty searchPath array is provided.
    let hasSearchPathOverrides = false;
    if (rawSearchPath && rawSearchPath.length > 0) {
      hasSearchPathOverrides = true;
    }
    let resolvedSearchPath: string[] = [...DEFAULT_ZTD_CONFIG.ddl.searchPath];
    if (hasSearchPathOverrides && rawSearchPath) {
      resolvedSearchPath = rawSearchPath.filter(
        (schema: unknown): schema is string =>
          typeof schema === 'string' && schema.length > 0
      );
    }
    return {
      dialect: typeof raw.dialect === 'string' ? raw.dialect : DEFAULT_ZTD_CONFIG.dialect,
      ddlDir: typeof raw.ddlDir === 'string' && raw.ddlDir.length ? raw.ddlDir : DEFAULT_ZTD_CONFIG.ddlDir,
      testsDir:
        typeof raw.testsDir === 'string' && raw.testsDir.length ? raw.testsDir : DEFAULT_ZTD_CONFIG.testsDir,
      ddl: {
        defaultSchema:
          typeof rawDdl?.defaultSchema === 'string' && rawDdl.defaultSchema.length
            ? rawDdl.defaultSchema
            : DEFAULT_ZTD_CONFIG.ddl.defaultSchema,
        searchPath: resolvedSearchPath
      }
      ,
      connection: normalizeConnectionConfig(rawConnection)
    };
  } catch (error) {
    throw new Error(`${CONFIG_NAME} is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function writeZtdProjectConfig(
  rootDir: string,
  overrides: Partial<ZtdProjectConfig> = {}
): void {
  const baseConfig = loadZtdProjectConfig(rootDir);
  const finalConfig: ZtdProjectConfig = {
    ...baseConfig,
    ...overrides,
    ddl: {
      ...baseConfig.ddl,
      ...(overrides.ddl ?? {})
    }
  };
  const resolvedConnection = mergeConnectionConfig(baseConfig.connection, overrides.connection);
  if (resolvedConnection) {
    finalConfig.connection = resolvedConnection;
  } else {
    delete finalConfig.connection;
  }

  const serialized = `${JSON.stringify(finalConfig, null, 2)}\n`;
  writeFileSync(resolveZtdConfigPath(rootDir), serialized, 'utf8');
}

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
