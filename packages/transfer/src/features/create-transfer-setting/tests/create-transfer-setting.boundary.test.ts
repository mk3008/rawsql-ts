import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';

import { execute, type CreateTransferSettingInput } from '../boundary.js';
import type { FeatureQueryExecutor } from '../../_shared/featureQueryExecutor.js';

const validInput: CreateTransferSettingInput = {
  name: 'sales_transfer',
  description: '売上転送',
  sourceSqlBody:
    'select sale_id, sale_date, customer_id, amount, remarks from sales_transfer_source',
  sourceKeyDefinition: {
    keys: [{ name: 'sale_id', sourceColumn: 'sale_id', type: 'bigint' }],
  },
  destinations: [
    {
      destinationDefinitionName: 'journal',
      executionOrder: 1,
      sourceKeyDefinition: {
        keys: [{ name: 'sale_id', sourceColumn: 'sale_id', type: 'bigint' }],
      },
      mappingDefinition: {
        columns: {
          journal_date: 'sale_date',
          customer_id: 'customer_id',
          amount: 'amount',
          remarks: 'remarks',
        },
      },
      diffCompareExcludedColumns: {
        columns: ['journal_id', 'created_at'],
      },
      note: 'journal mapping',
    },
  ],
  note: 'reviewed',
};

test('creates a transfer setting and destination links in one transaction', async () => {
  const seenQueries: Array<{ sql: string; params: Record<string, unknown> }> = [];
  const executor = createMockTransactionalExecutor(seenQueries);

  const result = await execute(executor, validInput);

  expect(result.transferSetting).toMatchObject({
    transferSettingId: '100',
    name: 'sales_transfer',
    sourceSqlHash: createHash('sha256').update(validInput.sourceSqlBody).digest('hex'),
    sourceKeyDefinition: validInput.sourceKeyDefinition,
    sourceSqlAnalysisResult: null,
    searchConditionAnalysisResult: null,
    sourceSqlAnalysisStatus: 'not_analyzed',
    sourceSqlAnalysisError: null,
  });
  expect(result.destinations).toHaveLength(1);
  expect(result.destinations[0]).toMatchObject({
    transferSettingDestinationDefinitionId: '200',
    transferSettingId: '100',
    transferDestinationDefinitionId: '10',
    executionOrder: 1,
    diffCompareExcludedColumns: validInput.destinations[0]?.diffCompareExcludedColumns,
    generatedInsertTransferSqlBody: '',
    generatedUpdateTransferSqlBody: '',
    generatedRedTransferSqlBody: '',
    generatedDeleteTransferSqlBody: '',
    generatedSqlStatus: 'not_generated',
    generatedSqlError: null,
  });
  expect(seenQueries.map((entry) => classifyQuery(entry.sql))).toEqual([
    'resolve-destinations',
    'insert-transfer-setting',
    'insert-transfer-setting-destination',
  ]);
  expect(seenQueries[1]?.params).toMatchObject({
    transfer_setting_name: 'sales_transfer',
    source_key_definition: validInput.sourceKeyDefinition,
    source_sql_analysis_result: null,
    search_condition_analysis_result: null,
    source_sql_analysis_status: 'not_analyzed',
    source_sql_analysis_error: null,
    is_enabled: true,
  });
  expect(seenQueries[2]?.params).toMatchObject({
    transfer_setting_id: '100',
    transfer_destination_definition_id: '10',
    execution_order: 1,
    diff_compare_excluded_columns: validInput.destinations[0]?.diffCompareExcludedColumns,
    is_enabled: true,
  });
});

test.each([
  [
    'duplicate executionOrder',
    {
      destinations: [
        validInput.destinations[0],
        {
          ...validInput.destinations[0],
          destinationDefinitionName: 'account_balance',
        },
      ],
    },
  ],
  [
    'duplicate destinationDefinitionName',
    {
      destinations: [
        validInput.destinations[0],
        {
          ...validInput.destinations[0],
          executionOrder: 2,
        },
      ],
    },
  ],
  ['empty destinations', { destinations: [] }],
  ['empty source SQL', { sourceSqlBody: '   ' }],
])('rejects invalid input: %s', async (_name, patch) => {
  const executor = createGuardedTransactionalExecutor();
  await expect(
    execute(executor, {
      ...validInput,
      ...patch,
    }),
  ).rejects.toThrow();
});

test('rejects missing destination definitions before inserting the transfer setting', async () => {
  const seenQueries: Array<{ sql: string; params: Record<string, unknown> }> = [];
  const executor = createMockTransactionalExecutor(seenQueries, { resolvedDestinations: [] });

  await expect(execute(executor, validInput)).rejects.toThrow(
    /Unknown transfer destination definitions/,
  );
  expect(seenQueries.map((entry) => classifyQuery(entry.sql))).toEqual(['resolve-destinations']);
});

test('requires a transactional executor', async () => {
  const executor: FeatureQueryExecutor = {
    async query() {
      throw new Error('query should not be reached');
    },
  };

  await expect(execute(executor, validInput)).rejects.toThrow(/transactional executor/);
});

function createGuardedTransactionalExecutor(): FeatureQueryExecutor {
  return {
    async query() {
      throw new Error('Validation failures must not reach the query boundary.');
    },
    async transaction(operation) {
      return operation(this);
    },
  };
}

function createMockTransactionalExecutor(
  seenQueries: Array<{ sql: string; params: Record<string, unknown> }>,
  options: { resolvedDestinations?: Array<Record<string, unknown>> } = {},
): FeatureQueryExecutor {
  return {
    async query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]> {
      seenQueries.push({ sql, params });
      const kind = classifyQuery(sql);
      if (kind === 'resolve-destinations') {
        return (options.resolvedDestinations ?? [
          {
            transfer_destination_definition_id: '10',
            transfer_destination_definition_name: 'journal',
          },
        ]) as T[];
      }
      if (kind === 'insert-transfer-setting') {
        return [
          {
            transfer_setting_id: '100',
            transfer_setting_name: params.transfer_setting_name,
            description: params.description,
            source_sql_body: params.source_sql_body,
            source_sql_hash: params.source_sql_hash,
            source_key_definition: params.source_key_definition,
            source_sql_analysis_result: params.source_sql_analysis_result,
            search_condition_analysis_result: params.search_condition_analysis_result,
            source_sql_analysis_status: params.source_sql_analysis_status,
            source_sql_analysis_error: params.source_sql_analysis_error,
            is_enabled: params.is_enabled,
            created_at: new Date('2026-05-02T00:00:00.000Z'),
            updated_at: new Date('2026-05-02T00:00:00.000Z'),
            note: params.note,
          },
        ] as T[];
      }
      if (kind === 'insert-transfer-setting-destination') {
        return [
          {
            transfer_setting_destination_definition_id: '200',
            transfer_setting_id: params.transfer_setting_id,
            transfer_destination_definition_id: params.transfer_destination_definition_id,
            execution_order: params.execution_order,
            source_key_definition: params.source_key_definition,
            mapping_definition: params.mapping_definition,
            diff_compare_excluded_columns: params.diff_compare_excluded_columns,
            generated_insert_transfer_sql_body: '',
            generated_update_transfer_sql_body: '',
            generated_red_transfer_sql_body: '',
            generated_delete_transfer_sql_body: '',
            generated_sql_status: 'not_generated',
            generated_sql_error: null,
            is_enabled: params.is_enabled,
            created_at: new Date('2026-05-02T00:00:00.000Z'),
            updated_at: new Date('2026-05-02T00:00:00.000Z'),
            note: params.note,
          },
        ] as T[];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async transaction(operation) {
      return operation(this);
    },
  };
}

function classifyQuery(sql: string): string {
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();
  if (normalizedSql.includes('"transfer_destination_definition_name" = any')) {
    return 'resolve-destinations';
  }
  if (normalizedSql.includes('insert into "public"."transfer_setting_destination_definition"')) {
    return 'insert-transfer-setting-destination';
  }
  if (normalizedSql.includes('insert into "public"."transfer_setting"')) {
    return 'insert-transfer-setting';
  }
  return 'unknown';
}
