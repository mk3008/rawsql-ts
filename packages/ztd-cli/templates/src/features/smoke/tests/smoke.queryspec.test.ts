import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createCatalogExecutor, type Binder } from '@rawsql-ts/sql-contract';
import { Pool } from 'pg';
import { expect, test } from 'vitest';

import { smokeSpec } from '../persistence/smoke.spec.js';

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
      'Set ZTD_TEST_DATABASE_URL before running src/features/smoke/tests/smoke.queryspec.test.ts.'
    );
  }

  const pool = new Pool({ connectionString });
  const catalog = createCatalogExecutor({
    loader: {
      async load(sqlFile) {
        return readFile(path.join(process.cwd(), sqlFile), 'utf8');
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
