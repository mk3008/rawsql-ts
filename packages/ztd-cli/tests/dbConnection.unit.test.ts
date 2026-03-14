import { expect, test } from 'vitest';
import {
  resolveExplicitTargetConnection,
  resolveZtdOwnedTestConnection
} from '../src/utils/dbConnection';

function withEnv<T>(
  values: Partial<Record<'DATABASE_URL' | 'ZTD_TEST_DATABASE_URL', string | undefined>>,
  fn: () => T
): T {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousZtdTestDatabaseUrl = process.env.ZTD_TEST_DATABASE_URL;
  try {
    for (const [key, value] of Object.entries(values) as Array<['DATABASE_URL' | 'ZTD_TEST_DATABASE_URL', string | undefined]>) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    return fn();
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousZtdTestDatabaseUrl === undefined) {
      delete process.env.ZTD_TEST_DATABASE_URL;
    } else {
      process.env.ZTD_TEST_DATABASE_URL = previousZtdTestDatabaseUrl;
    }
  }
}

test('ZTD-owned connection uses only ZTD_TEST_DATABASE_URL', () => {
  const connection = withEnv(
    {
      ZTD_TEST_DATABASE_URL: 'postgres://ztd_user:secret@test-host:5439/ztd_db',
      DATABASE_URL: 'postgres://app_user:secret@app-host:5432/app_db'
    },
    () => resolveZtdOwnedTestConnection()
  );

  expect(connection.context.source).toBe('ztd-test-env');
  expect(connection.context.host).toBe('test-host');
  expect(connection.context.port).toBe(5439);
  expect(connection.context.user).toBe('ztd_user');
  expect(connection.context.database).toBe('ztd_db');
});

test('--url takes precedence over --db-* for explicit target connections', () => {
  const connection = resolveExplicitTargetConnection(
    {
      host: 'flags.example',
      port: '6543',
      user: 'flag-user',
      password: 'p@ss',
      database: 'flag_db'
    },
    'postgres://cli-user:secret@cli-host:3421/cli-db'
  );

  expect(connection.context.source).toBe('explicit-url');
  expect(connection.context.host).toBe('cli-host');
  expect(connection.context.port).toBe(3421);
  expect(connection.context.user).toBe('cli-user');
  expect(connection.context.database).toBe('cli-db');
  expect(connection.url).toBe('postgres://cli-user:secret@cli-host:3421/cli-db');
});

test('explicit --db-* flags are used when --url is absent', () => {
  const connection = resolveExplicitTargetConnection({
    host: 'flags.example',
    port: '6543',
    user: 'flag-user',
    password: 'p@ss',
    database: 'flag_db'
  });

  expect(connection.context.source).toBe('explicit-flags');
  expect(connection.context.host).toBe('flags.example');
  expect(connection.context.port).toBe(6543);
  expect(connection.context.database).toBe('flag_db');
});

test('explicit target resolution ignores DATABASE_URL and ZTD_TEST_DATABASE_URL', () => {
  const connection = withEnv(
    {
      DATABASE_URL: 'postgres://app_user:secret@app-host:5432/app_db',
      ZTD_TEST_DATABASE_URL: 'postgres://ztd_user:secret@test-host:5439/ztd_db'
    },
    () =>
      resolveExplicitTargetConnection(
        {
          host: 'flags.example',
          port: '6543',
          user: 'flag-user',
          password: 'p@ss',
          database: 'flag_db'
        }
      )
  );

  expect(connection.context.host).toBe('flags.example');
  expect(connection.context.source).toBe('explicit-flags');
});

test('partial explicit --db-* flags fail with a clear error', () => {
  expect(() =>
    resolveExplicitTargetConnection({
      host: 'flags.example',
      user: 'flag-user'
    })
  ).toThrow(/Incomplete explicit target database flags/);
});

test('missing ZTD-owned connection reports actionable error', () => {
  withEnv({ DATABASE_URL: 'postgres://app_user:secret@app-host:5432/app_db', ZTD_TEST_DATABASE_URL: undefined }, () => {
    expect(() => resolveZtdOwnedTestConnection()).toThrow(/ZTD_TEST_DATABASE_URL is required/);
  });
});

test('missing explicit target info reports actionable error', () => {
  expect(() => resolveExplicitTargetConnection({})).toThrow(
    /This command does not use implicit database settings/
  );
});
