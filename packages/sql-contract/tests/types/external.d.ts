declare module 'mssql' {
  export interface ConnectionPoolConfig {
    server: string
    port: number
    user: string
    password: string
    database?: string
    options?: {
      trustServerCertificate?: boolean
    }
  }

  export class ConnectionPool {
    constructor(config: ConnectionPoolConfig)
    connect(): Promise<ConnectionPool>
    query<T = Record<string, unknown>>(sql: string): Promise<{ recordset: T[] }>
    close(): Promise<void>
  }
}

declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }

  export class Database {
    exec(sql: string): QueryExecResult[]
    close(): void
  }

  export interface InitSqlJsConfig {
    locateFile?: (filename: string) => string
  }

  export default function initSqlJs(
    config?: InitSqlJsConfig
  ): Promise<{ Database: typeof Database }>
}
