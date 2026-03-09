import { expect, test } from 'vitest';
import {
  buildInsertStatementsForTable,
  buildPerfInitPlan,
  parsePerfSeedYaml,
  type PerfSeedConfig
} from '../src/perf/sandbox';
import type { TableDefinitionModel } from 'rawsql-ts';

const usersDefinition: TableDefinitionModel = {
  name: 'public.users',
  columns: [
    { name: 'id', typeName: 'integer', isNotNull: true, required: true },
    { name: 'status', typeName: 'text', isNotNull: true },
    { name: 'score', typeName: 'numeric', isNotNull: false }
  ]
};

test('buildPerfInitPlan scaffolds the expected perf sandbox files', () => {
  const plan = buildPerfInitPlan('C:/workspace/example');
  const relativeFiles = plan.files.map((file) => file.path.replace(/\\/g, '/')).map((filePath) => filePath.slice(filePath.indexOf('/perf/'))).map((filePath) => filePath.slice(1)).sort();

  expect(relativeFiles).toEqual([
    'perf/.gitignore',
    'perf/README.md',
    'perf/docker-compose.yml',
    'perf/params.yml',
    'perf/sandbox.json',
    'perf/seed.yml'
  ]);
});

test('parsePerfSeedYaml reads deterministic row counts and column overrides', () => {
  const config = parsePerfSeedYaml([
    'seed: 123',
    'tables:',
    '  users:',
    '    rows: 25',
    'columns:',
    '  public.users.status:',
    '    values: [active, inactive]',
    '    skew: 0.9',
    ''
  ].join('\n'));

  expect(config).toEqual<PerfSeedConfig>({
    seed: 123,
    tables: {
      users: { rows: 25 }
    },
    columns: {
      'public.users.status': {
        values: ['active', 'inactive'],
        skew: 0.9
      }
    }
  });
});

test('buildInsertStatementsForTable stays deterministic for a fixed seed config', () => {
  const seedConfig: PerfSeedConfig = {
    seed: 496,
    tables: { users: { rows: 2 } },
    columns: {
      'public.users.status': {
        values: ['active', 'inactive'],
        skew: 0.75
      }
    }
  };

  const firstRun = buildInsertStatementsForTable(usersDefinition, 2, seedConfig);
  const secondRun = buildInsertStatementsForTable(usersDefinition, 2, seedConfig);

  expect(firstRun).toEqual(secondRun);
  expect(firstRun[0]?.sql).toContain('INSERT INTO "public"."users"');
  expect(firstRun[0]?.values[1]).toBe('active');
  expect(firstRun[1]?.values[0]).toBe(2);
});

