import { expect, test } from 'vitest';
import { DEFAULT_ZTD_CONFIG } from '../src/utils/ztdProjectConfig';
import { resolveDatabaseConnection } from '../src/utils/dbConnection';

function withEnv<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.DATABASE_URL;
  try {
    if (value === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = value;
    }
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
  }
}

test('explicit --db-* flags override DATABASE_URL', () => {
  const connection = withEnv('postgres://env:user@envhost:5432/envdb', () =>
    resolveDatabaseConnection(
      {
        host: 'flags.example',
        port: '6543',
        user: 'flag-user',
        password: 'p@ss',
        database: 'flag_db'
      },
      DEFAULT_ZTD_CONFIG
    )
  );

  expect(connection.context.source).toBe('flags');
  expect(connection.context.host).toBe('flags.example');
  expect(connection.context.port).toBe(6543);
  expect(connection.context.database).toBe('flag_db');
  expect(connection.url).toContain('flags.example');
  expect(connection.url).toContain('flag_db');
});

test('DATABASE_URL is used when no flags provided', () => {
  const url = 'postgres://envuser:envpass@envhost:5432/envdb';
  const connection = withEnv(url, () =>
    resolveDatabaseConnection({}, DEFAULT_ZTD_CONFIG)
  );

  expect(connection.context.source).toBe('environment');
  expect(connection.context.host).toBe('envhost');
  expect(connection.context.database).toBe('envdb');
  expect(connection.url).toBe(url);
});

test('explicit URL argument supplies context when provided without other overrides', () => {
  const url = 'postgres://cli-user:secret@cli-host:3421/cli-db';
  const connection = resolveDatabaseConnection({}, DEFAULT_ZTD_CONFIG, url);

  expect(connection.context.source).toBe('flags');
  expect(connection.context.host).toBe('cli-host');
  expect(connection.context.port).toBe(3421);
  expect(connection.context.user).toBe('cli-user');
  expect(connection.context.database).toBe('cli-db');
  expect(connection.url).toBe(url);
});

test('configuration block is used when no env or flags exist', () => {
  const projectConfig = {
    ...DEFAULT_ZTD_CONFIG,
    connection: {
      host: 'cfg',
      user: 'cfg-user',
      database: 'cfg-db',
      port: 9999
    }
  };
  const connection = resolveDatabaseConnection({}, projectConfig);

  expect(connection.context.source).toBe('config');
  expect(connection.context.host).toBe('cfg');
  expect(connection.context.port).toBe(9999);
  expect(connection.context.user).toBe('cfg-user');
  expect(connection.context.database).toBe('cfg-db');
});

test('missing connection info reports actionable error', () => {
  withEnv(undefined, () => {
    expect(() => resolveDatabaseConnection({}, DEFAULT_ZTD_CONFIG)).toThrow(
      /DATABASE_URL|--db-host|connection block/
    );
  });
});
