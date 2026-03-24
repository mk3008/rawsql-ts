import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCatalogExecutor, type Binder } from '@rawsql-ts/sql-contract';
import { Pool } from 'pg';
import { expect, test } from 'vitest';

import { smokeSpec } from '../persistence/smoke.spec.js';

const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const featurePersistenceDir = path.resolve(testFileDir, '..', 'persistence');

const namedParameterBinder: Binder = {
  name: 'smoke-named-parameter-binder',
  bind({ specId, sql, params }) {
    if (Array.isArray(params)) {
      throw new Error(`Spec "${specId}" expected named parameters for the smoke QuerySpec test.`);
    }

    const values: unknown[] = [];
    const compiledSql = sql.replace(/(?<!:):([A-Za-z][A-Za-z0-9_]*)\b/g, (_match, parameterName: string) => {
      if (!(parameterName in params)) {
        throw new Error(`Spec "${specId}" is missing the named parameter "${parameterName}".`);
      }

      values.push(params[parameterName]);
      return `$${values.length}`;
    });

    return {
      sql: compiledSql,
      params: values
    };
  }
};

test('smoke QuerySpec connects to the configured DB and runs the minimal named-parameter query', async () => {
  const connectionString = process.env.ZTD_TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Set ZTD_DB_PORT in .env before running src/features/smoke/tests/smoke.queryspec.test.ts.'
    );
  }

  const pool = new Pool({ connectionString });
  const catalog = createCatalogExecutor({
    loader: {
      async load(sqlFile) {
        return readFile(path.resolve(featurePersistenceDir, sqlFile), 'utf8');
      }
    },
    binders: [namedParameterBinder],
    executor: (sql, params) => pool.query(sql, params as unknown[])
  });

  try {
    const result = await catalog.scalar(smokeSpec, {
      v1: 2,
      v2: 3
    });

    expect(result).toBe(5);
  } finally {
    await pool.end();
  }
});
