import {
  resolveExplicitTargetConnection,
  resolveZtdOwnedTestConnection
} from '../utils/dbConnection';
import type { DbConnectionFlags, ResolvedDatabaseConnection } from '../utils/dbConnection';

export interface ConnectionCliOptions {
  url?: string;
  dbHost?: string;
  dbPort?: string;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
}

export function resolveExplicitCliConnection(options: ConnectionCliOptions): ResolvedDatabaseConnection {
  return resolveExplicitTargetConnection(buildFlagSet(options), options.url);
}

export function resolveZtdOwnedCliConnection(): ResolvedDatabaseConnection {
  return resolveZtdOwnedTestConnection();
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
