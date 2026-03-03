import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';
import { resolveDatabaseConnection } from '../utils/dbConnection';
import type { DbConnectionFlags, ResolvedDatabaseConnection } from '../utils/dbConnection';

export interface ConnectionCliOptions {
  url?: string;
  dbHost?: string;
  dbPort?: string;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
}

export function resolveCliConnection(options: ConnectionCliOptions): ResolvedDatabaseConnection {
  return resolveDatabaseConnection(buildFlagSet(options), loadZtdProjectConfig(), options.url);
}

export function buildFlagSet(options: ConnectionCliOptions): DbConnectionFlags {
  return {
    host: options.dbHost,
    port: options.dbPort,
    user: options.dbUser,
    password: options.dbPassword,
    database: options.dbName
  };
}
