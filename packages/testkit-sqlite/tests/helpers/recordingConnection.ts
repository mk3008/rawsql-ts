import Database from 'better-sqlite3';
import type { SqliteConnectionLike, SqliteStatementLike } from '../../src/types';

export type RecordedStatement = {
  sql: string;
  stage: 'prepare' | 'direct' | 'statement';
};

const wrapStatement = (
  statement: SqliteStatementLike,
  sql: string,
  statements: RecordedStatement[]
): SqliteStatementLike => {
  // Append instrumentation to record the rewritten SQL whenever the statement runs.
  return new Proxy(statement, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') {
        return value;
      }

      if (prop === 'all' || prop === 'get' || prop === 'run') {
        return (...args: unknown[]) => {
          statements.push({ sql, stage: 'statement' });
          return value.apply(target, args);
        };
      }

      return value.bind(target);
    },
  });
};

export type RecordingConnection = {
  driver: SqliteConnectionLike;
  statements: RecordedStatement[];
  close: () => void;
};

export const createRecordingConnection = (): RecordingConnection => {
  const db = new Database(':memory:');
  const statements: RecordedStatement[] = [];
  let closed = false;

  // Guard to ensure the native handle is disposed only once.
  const close = () => {
    if (!closed) {
      closed = true;
      db.close();
    }
  };

  const proxy = new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'close') {
        return close;
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') {
        return value;
      }

      if (prop === 'prepare') {
        // Track SQL strings as they enter the driver before being executed.
        return (sql: string, ...args: unknown[]) => {
          statements.push({ sql, stage: 'prepare' });
          const statement = value.apply(target, [sql, ...args]) as SqliteStatementLike;
          return wrapStatement(statement, sql, statements);
        };
      }

      if (prop === 'exec' || prop === 'all' || prop === 'get' || prop === 'run') {
        // Capture helper methods that bypass prepare().
        return (sql: string, ...args: unknown[]) => {
          statements.push({ sql, stage: 'direct' });
          return value.apply(target, [sql, ...args]);
        };
      }

      return value.bind(target);
    },
  });

  return { driver: proxy as SqliteConnectionLike, statements, close };
};
