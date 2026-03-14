export interface DbConnectionFlags {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
}

export type DbConnectionSource = 'ztd-test-env' | 'explicit-url' | 'explicit-flags';

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
const ZTD_TEST_DATABASE_ENV = 'ZTD_TEST_DATABASE_URL';

/**
 * Resolves the single implicit database owned by ztd-cli.
 * @returns The managed ZTD test database connection plus sanitized context metadata.
 */
export function resolveZtdOwnedTestConnection(): ResolvedDatabaseConnection {
  const envUrl = (process.env[ZTD_TEST_DATABASE_ENV] ?? '').trim();
  if (!envUrl) {
    throw new Error(
      `${ZTD_TEST_DATABASE_ENV} is required for this ZTD-owned workflow. ztd-cli does not read DATABASE_URL implicitly.`
    );
  }

  return {
    url: envUrl,
    context: {
      source: 'ztd-test-env',
      ...parseUrlContext(envUrl)
    }
  };
}

/**
 * Resolves an explicit non-ZTD target connection.
 * @param flags - Explicit target fields supplied by the caller.
 * @param explicitUrl - Fully-qualified explicit target URL.
 * @returns The target connection plus sanitized context metadata.
 */
export function resolveExplicitTargetConnection(
  flags: DbConnectionFlags,
  explicitUrl?: string
): ResolvedDatabaseConnection {
  const trimmedExplicitUrl = explicitUrl?.trim();
  if (trimmedExplicitUrl) {
    // Explicit URLs always win so callers can override any partially supplied field set.
    return {
      url: trimmedExplicitUrl,
      context: {
        source: 'explicit-url',
        ...parseUrlContext(trimmedExplicitUrl)
      }
    };
  }

  if (hasExplicitFlags(flags)) {
    return resolveFromFlags(flags);
  }

  throw new Error(
    'This command does not use implicit database settings. Pass --url or --db-* explicitly.'
  );
}

/** Determines whether the caller provided any explicit target flag. */
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
 * Builds a complete explicit target connection when flag-based overrides are present.
 * @param flags - Explicit connection fields supplied by the caller.
 * @returns The canonical PostgreSQL URL plus metadata about the explicit target.
 */
function resolveFromFlags(flags: DbConnectionFlags): ResolvedDatabaseConnection {
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

  // Fail partial flag combinations so callers do not accidentally inspect the wrong target.
  if (missing.length) {
    throw new Error(
      `Incomplete explicit target database flags. Missing ${missing.join(', ')}. Provide all required fields or use --url.`
    );
  }

  const port = normalizePort(flags.port);
  const numericPort = port ?? DEFAULT_PORT;
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
      source: 'explicit-flags',
      host: flags.host!,
      port: numericPort,
      user: flags.user!,
      database: flags.database!
    }
  };
}

/**
 * Normalizes a port string/number into a valid TCP port or undefined when absent.
 * @param port - User-supplied port string or number.
 * @returns The validated numeric port or undefined when the input is missing.
 */
function normalizePort(port?: string | number): number | undefined {
  if (port === undefined) {
    return undefined;
  }
  const parsed = typeof port === 'number' ? port : Number(port);
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
 * @param urlValue - Connection string provided by the caller.
 * @returns Partial context describing host, port, user, and database.
 */
function parseUrlContext(urlValue: string): Partial<DbConnectionContext> {
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
