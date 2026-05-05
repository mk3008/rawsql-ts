import { createHash } from 'node:crypto';

import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';
import type { CreateTransferSettingDestinationInput, CreateTransferSettingInput } from './input.js';
import {
  executeInsertTransferSettingQuerySpec,
  type InsertTransferSettingQueryResult
} from './queries/insert-transfer-setting/boundary.js';
import {
  executeInsertTransferSettingDestinationDefinitionQuerySpec,
  type InsertTransferSettingDestinationDefinitionQueryResult
} from './queries/insert-transfer-setting-destination-definition/boundary.js';
import { executeResolveTransferDestinationDefinitionsQuerySpec } from './queries/resolve-transfer-destination-definitions/boundary.js';

export type CreateTransferSettingWorkflowResult = {
  transferSetting: InsertTransferSettingQueryResult;
  destinations: InsertTransferSettingDestinationDefinitionQueryResult[];
};

type TransactionalFeatureQueryExecutor = FeatureQueryExecutor & {
  transaction<T>(operation: (executor: FeatureQueryExecutor) => Promise<T>): Promise<T>;
};

/**
 * Runs the create-transfer-setting use case in one transaction.
 *
 * This issue persists the setting and destination links only: source SQL parsing and
 * generated SQL creation are intentionally deferred.
 */
export async function execute(
  executor: FeatureQueryExecutor,
  request: CreateTransferSettingInput
): Promise<CreateTransferSettingWorkflowResult> {
  // Creating a transfer setting writes the parent setting and one or more destination links.
  // Require a transaction so a partial setting cannot be persisted.
  const transactionalExecutor = assertTransactionalExecutor(executor);

  return transactionalExecutor.transaction(async (transactionExecutor) => {
    // Public input refers to destination definitions by name.
    // Resolve names inside the transaction before inserting the link rows.
    const destinationDefinitionIdByName = await resolveTransferDestinationDefinitionIds(
      transactionExecutor,
      request.destinations
    );

    const transferSetting = await insertTransferSetting(transactionExecutor, request);
    const destinations = await insertTransferSettingDestinations(
      transactionExecutor,
      transferSetting.transfer_setting_id,
      request.destinations,
      destinationDefinitionIdByName
    );

    return { transferSetting, destinations };
  });
}

function assertTransactionalExecutor(executor: FeatureQueryExecutor): TransactionalFeatureQueryExecutor {
  if (typeof executor.transaction !== 'function') {
    throw new Error('create-transfer-setting requires a transactional executor.');
  }
  return executor as TransactionalFeatureQueryExecutor;
}

/**
 * Public input identifies destination definitions by name.
 * Resolve those names to IDs inside the transaction before link rows are inserted.
 */
async function resolveTransferDestinationDefinitionIds(
  executor: FeatureQueryExecutor,
  destinations: readonly CreateTransferSettingDestinationInput[]
): Promise<Map<string, string>> {
  const destinationDefinitionNames = destinations.map((destination) => destination.destinationDefinitionName);
  const result = await executeResolveTransferDestinationDefinitionsQuerySpec(executor, {
    destination_definition_names: destinationDefinitionNames
  });
  const idByName = new Map(
    result.items.map((item) => [
      item.transfer_destination_definition_name,
      item.transfer_destination_definition_id
    ])
  );
  const missingNames = destinationDefinitionNames.filter((name) => !idByName.has(name));
  if (missingNames.length > 0) {
    throw new Error(`Unknown transfer destination definitions: ${missingNames.join(', ')}.`);
  }
  return idByName;
}

/**
 * Stores the source SQL body with a deterministic hash.
 * Full SQL parsing is out of scope, so analysis fields remain empty and status is not_analyzed.
 */
async function insertTransferSetting(
  executor: FeatureQueryExecutor,
  request: CreateTransferSettingInput
): Promise<InsertTransferSettingQueryResult> {
  return executeInsertTransferSettingQuerySpec(executor, {
    transfer_setting_name: request.name,
    description: request.description ?? null,
    source_sql_body: request.sourceSqlBody,
    source_sql_hash: hashSourceSql(request.sourceSqlBody),
    source_sql_analysis_result: null,
    search_condition_analysis_result: null,
    source_sql_analysis_status: 'not_analyzed',
    source_sql_analysis_error: null,
    is_enabled: request.isEnabled ?? true,
    note: request.note ?? null
  });
}

/**
 * Inserts destination links without generating transfer SQL yet.
 * Generated SQL columns are initialized as placeholders in this issue.
 */
async function insertTransferSettingDestinations(
  executor: FeatureQueryExecutor,
  transferSettingId: string,
  destinations: readonly CreateTransferSettingDestinationInput[],
  destinationDefinitionIdByName: ReadonlyMap<string, string>
): Promise<InsertTransferSettingDestinationDefinitionQueryResult[]> {
  const insertedDestinations: InsertTransferSettingDestinationDefinitionQueryResult[] = [];

  for (const destination of destinations) {
    const transferDestinationDefinitionId = destinationDefinitionIdByName.get(destination.destinationDefinitionName);
    if (!transferDestinationDefinitionId) {
      throw new Error(`Unknown transfer destination definition: ${destination.destinationDefinitionName}.`);
    }

    insertedDestinations.push(
      await executeInsertTransferSettingDestinationDefinitionQuerySpec(executor, {
        transfer_setting_id: transferSettingId,
        transfer_destination_definition_id: transferDestinationDefinitionId,
        execution_order: destination.executionOrder,
        source_key_definition: destination.sourceKeyDefinition,
        mapping_definition: destination.mappingDefinition,
        diff_compare_excluded_columns: destination.diffCompareExcludedColumns ?? null,
        is_enabled: destination.isEnabled ?? true,
        note: destination.note ?? null
      })
    );
  }

  return insertedDestinations;
}

function hashSourceSql(sourceSqlBody: string): string {
  return createHash('sha256').update(sourceSqlBody).digest('hex');
}
