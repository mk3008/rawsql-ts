import { ZtdProjectConfig } from './ztdProjectConfig';

export interface DbConnectionFlags {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
  url?: string;
}

export type DbConnectionSource = 'flags' | 'environment' | 'config';

export interface DbConnectionContext {
  source: DbConnectionSource;
  host?: string;
  port?: number;
  user?: string;
  database?: string;
}

export interface ResolvedDatabaseConnection {
  url: string;
  context: DbConnectionContext;
}

const DEFAULT_PORT = 5432;

/**
 * Resolves the database connection URL/context by checking environment variables, CLI flags, and project config.
 * @param flags - CLI overrides supplied by the user.
 * @param config - Project-level defaults defined in ztd.config.json.
 * @param explicitUrl - Optional explicit URL argument supplied to the CLI command.
 * @returns The resolved URL plus contextual metadata.
 */
export function resolveDatabaseConnection(
  flags: DbConnectionFlags,
  config: ZtdProjectConfig,
  explicitUrl?: string
): ResolvedDatabaseConnection {
  // Prefer DATABASE_URL when provided so the consumer can rely on a single override.
  const envUrl = (process.env.DATABASE_URL ?? '').trim();
  if (envUrl) {
    return {
      url: envUrl,
      context: {
        source: 'environment',
        ...parseUrlContext(envUrl)
      }
    };
  }

  const trimmedExplicitUrl = explicitUrl?.trim();
  if (trimmedExplicitUrl) {
    // Use the caller-provided connection string directly when no environment override exists.
    return {
      url: trimmedExplicitUrl,
      context: {
        source: 'flags',
        ...parseUrlContext(trimmedExplicitUrl)
      }
    };
  }

  // Explicit CLI flags are the next fallback if no URL context is available.
  if (hasExplicitFlags(flags)) {
    return resolveFromFlags(flags);
  }

  const connectionConfig = config.connection;
  if (connectionConfig) {
    // Fall back to the config block only when neither env nor CLI overrides exist.
    if (connectionConfig.url) {
      const trimmedConfigUrl = connectionConfig.url.trim();
      return {
        url: trimmedConfigUrl,
        context: {
          source: 'config',
          ...parseUrlContext(trimmedConfigUrl),
          ...(connectionConfig.host ? { host: connectionConfig.host } : {}),
          ...(connectionConfig.user ? { user: connectionConfig.user } : {}),
          ...(connectionConfig.database ? { database: connectionConfig.database } : {}),
          ...(connectionConfig.port ? { port: connectionConfig.port } : {})
        }
      };
    }
    return resolveFromConfig(connectionConfig);
  }

  throw new Error(
    'No database connection information supplied. Set the DATABASE_URL environment variable, pass --db-host/--db-user/--db-name flags, or add a connection block to ztd.config.json.'
  );
}

/** Determines whether the CLI provided explicit connection flags. */
function hasExplicitFlags(flags: DbConnectionFlags): boolean {
  return Boolean(
    flags.host ||
      flags.port ||
      flags.user ||
      flags.password ||
      flags.database
  );
}

/**
 * Builds a complete connection when explicit CLI flags are present.
 * @param flags - The parsed CLI flags containing host/user details.
 * @returns The resolved connection that includes a canonical URL and context metadata.
 */
function resolveFromFlags(flags: DbConnectionFlags): ResolvedDatabaseConnection {
  // Validate that all required pieces are present when the user asked for flag-based overrides.
  const missing = [];
  if (!flags.host) {
    missing.push('--db-host');
  }
  if (!flags.user) {
    missing.push('--db-user');
  }
  if (!flags.database) {
    missing.push('--db-name');
  }

  if (missing.length) {
    throw new Error(
      `Explicit DB flags were provided but ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing. Provide them to override DATABASE_URL.`
    );
  }

  const port = normalizePort(flags.port);
  const numericPort = port ?? DEFAULT_PORT;
  // Default to 5432 when the caller did not override the TCP port.
  const url = buildConnectionUrl({
    host: flags.host!,
    port: numericPort,
    user: flags.user!,
    password: flags.password,
    database: flags.database!
  });

  return {
    url,
    context: {
      source: 'flags',
      host: flags.host!,
      port: numericPort,
      user: flags.user!,
      database: flags.database!
    }
  };
}

/**
 * Converts a legacy connection block from ztd.config.json into a resolved connection context.
 * @param connection - Configuration-provided connection metadata.
 * @returns The resolved connection derived from the config block.
 */
function resolveFromConfig(connection: ZtdProjectConfig['connection']): ResolvedDatabaseConnection {
  // Treat the config connection as the last resort and ensure it contains the minimum information.
  const missing = [];
  if (!connection?.host) {
    missing.push('connection.host');
  }
  if (!connection?.user) {
    missing.push('connection.user');
  }
  if (!connection?.database) {
    missing.push('connection.database');
  }

  if (missing.length) {
    throw new Error(
      `Connection block in ztd.config.json is missing the following values: ${missing.join(', ')}. Provide them to form a fallback connection.`
    );
  }

  const port = normalizePort(connection?.port);
  const numericPort = port ?? DEFAULT_PORT;
  // Default to the Postgres standard port when none is configured.
  const url = buildConnectionUrl({
    host: connection!.host!,
    port: numericPort,
    user: connection!.user!,
    password: connection!.password,
    database: connection!.database!
  });

  return {
    url,
    context: {
      source: 'config',
      host: connection!.host,
      port: numericPort,
      user: connection!.user,
      database: connection!.database
    }
  };
}

/**
 * Normalizes a port string/number into a valid TCP port or undefined when absent.
 * @param port - User-supplied port string or number.
 * @returns The validated numeric port or undefined when the input is missing.
 */
function normalizePort(port?: string | number): number | undefined {
  // Skip validation when the caller did not provide a port string/value.
  if (port === undefined) {
    return undefined;
  }
  const parsed = typeof port === 'number' ? port : Number(port);
  // Ensure the numeric value falls within the allowable TCP port range.
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error('The port must be a positive integer between 1 and 65535.');
  }
  return parsed;
}

/**
 * Builds a canonical PostgreSQL connection URL from parsed segments.
 * @param host - The database host address.
 * @param port - The numeric TCP port to target.
 * @param user - Username to embed in the URL.
 * @param password - Optional password component.
 * @param database - Database name applied to the pathname.
 * @returns Fully-qualified PostgreSQL URL.
 */
function buildConnectionUrl({
  host,
  port,
  user,
  password,
  database
}: {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}): string {
  // Construct a canonical PostgreSQL connection URL from the provided pieces.
  const url = new URL('postgresql://');
  url.hostname = host;
  url.port = port.toString();
  url.username = user;
  if (password) {
    url.password = password;
  }
  url.pathname = `/${database}`;
  return url.toString();
}

/**
 * Extracts host/user/database metadata from a PostgreSQL-style URL.
 * @param urlValue - Connection string provided by the user or environment.
 * @returns Partial context describing host, port, user, and database.
 */
function parseUrlContext(urlValue: string): Partial<DbConnectionContext> {
  // Extract context metadata from the URL when it is well-formed.
  try {
    const parsed = new URL(urlValue);
    const database = parsed.pathname ? parsed.pathname.replace(/^\//, '') : undefined;
    return {
      host: parsed.hostname || undefined,
      port: parsed.port ? Number(parsed.port) : undefined,
      user: parsed.username || undefined,
      database: database && database.length ? database : undefined
    };
  } catch {
    return {};
  }
}
