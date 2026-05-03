import { z } from 'zod';
import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';

import {
  executeInsertTransferDestinationDefinitionQuerySpec,
  type InsertTransferDestinationDefinitionQueryParams,
  type InsertTransferDestinationDefinitionQueryResult
} from './queries/insert-transfer-destination-definition/boundary.js';

const TRANSFER_MODELS = ['immutable', 'mutable'] as const;

const DestinationColumnSchema = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  role: z.string().trim().min(1).optional()
}).strict();

const DestinationColumnsSchema = z.object({
  columns: z.array(DestinationColumnSchema)
}).strict();

const DestinationKeyDefinitionSchema = z.object({
  keys: z.array(z.string().trim().min(1))
}).strict();

const ColumnListSchema = z.object({
  columns: z.array(z.string().trim().min(1))
}).strict();

const RequestSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  destinationTableName: z.string().trim().min(1),
  destinationColumns: DestinationColumnsSchema,
  destinationKeyDefinition: DestinationKeyDefinitionSchema,
  sequenceExpressionDefinition: z.record(z.string(), z.string().trim().min(1)).optional(),
  transferModel: z.enum(TRANSFER_MODELS),
  signInversionColumns: ColumnListSchema.optional(),
  redTransferSourceColumns: ColumnListSchema.optional(),
  diffCompareExcludedColumns: ColumnListSchema.optional(),
  note: z.string().trim().min(1).optional()
}).strict();

export type CreateTransferDestinationDefinitionInput = z.infer<typeof RequestSchema>;

const ResponseSchema = z.object({
  transferDestinationDefinitionId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  destinationTableName: z.string(),
  destinationColumns: DestinationColumnsSchema,
  destinationKeyDefinition: DestinationKeyDefinitionSchema,
  sequenceExpressionDefinition: z.record(z.string(), z.string()).nullable(),
  transferModel: z.enum(TRANSFER_MODELS),
  signInversionColumns: ColumnListSchema.nullable(),
  redTransferSourceColumns: ColumnListSchema.nullable(),
  diffCompareExcludedColumns: ColumnListSchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  note: z.string().nullable()
}).strict();

export type CreateTransferDestinationDefinitionResult = z.infer<typeof ResponseSchema>;

function parseRequest(raw: unknown): CreateTransferDestinationDefinitionInput {
  return RequestSchema.parse(raw);
}

function normalizeRequest(request: CreateTransferDestinationDefinitionInput): CreateTransferDestinationDefinitionInput {
  return {
    ...request,
    destinationColumns: {
      columns: request.destinationColumns.columns.map((column) => ({
        ...column,
        role: column.role === undefined ? undefined : column.role
      }))
    },
    destinationKeyDefinition: {
      keys: request.destinationKeyDefinition.keys
    },
    sequenceExpressionDefinition: request.sequenceExpressionDefinition === undefined
      ? undefined
      : { ...request.sequenceExpressionDefinition },
    signInversionColumns: request.signInversionColumns === undefined
      ? undefined
      : { columns: request.signInversionColumns.columns },
    redTransferSourceColumns: request.redTransferSourceColumns === undefined
      ? undefined
      : { columns: request.redTransferSourceColumns.columns },
    diffCompareExcludedColumns: request.diffCompareExcludedColumns === undefined
      ? undefined
      : { columns: request.diffCompareExcludedColumns.columns }
  };
}

function rejectRequest(request: CreateTransferDestinationDefinitionInput): void {
  const destinationColumnNames = request.destinationColumns.columns.map((column) => column.name);
  const destinationColumnNameSet = new Set(destinationColumnNames);

  if (destinationColumnNames.length === 0) {
    throw new Error('destinationColumns.columns must contain at least one column.');
  }
  if (destinationColumnNameSet.size !== destinationColumnNames.length) {
    throw new Error('destinationColumns.columns[].name must be unique.');
  }
  if (request.destinationKeyDefinition.keys.length === 0) {
    throw new Error('destinationKeyDefinition.keys must contain at least one key.');
  }

  rejectUnknownColumnReferences(
    'destinationKeyDefinition.keys',
    request.destinationKeyDefinition.keys,
    destinationColumnNameSet
  );
  rejectUnknownColumnReferences(
    'sequenceExpressionDefinition',
    Object.keys(request.sequenceExpressionDefinition ?? {}),
    destinationColumnNameSet
  );
  rejectUnknownColumnReferences(
    'signInversionColumns.columns',
    request.signInversionColumns?.columns ?? [],
    destinationColumnNameSet
  );
  rejectUnknownColumnReferences(
    'redTransferSourceColumns.columns',
    request.redTransferSourceColumns?.columns ?? [],
    destinationColumnNameSet
  );
  rejectUnknownColumnReferences(
    'diffCompareExcludedColumns.columns',
    request.diffCompareExcludedColumns?.columns ?? [],
    destinationColumnNameSet
  );
}

function rejectUnknownColumnReferences(
  fieldName: string,
  referencedColumns: string[],
  destinationColumnNameSet: ReadonlySet<string>
): void {
  const unknownColumns = referencedColumns.filter((columnName) => !destinationColumnNameSet.has(columnName));
  if (unknownColumns.length > 0) {
    throw new Error(`${fieldName} references unknown destination columns: ${unknownColumns.join(', ')}.`);
  }
}

function toQueryParams(request: CreateTransferDestinationDefinitionInput): InsertTransferDestinationDefinitionQueryParams {
  return {
    transfer_destination_definition_name: request.name,
    description: request.description ?? null,
    destination_table_name: request.destinationTableName,
    destination_columns: request.destinationColumns,
    destination_key_definition: request.destinationKeyDefinition,
    sequence_expression_definition: request.sequenceExpressionDefinition ?? null,
    transfer_model: request.transferModel,
    sign_inversion_columns: request.signInversionColumns ?? null,
    red_transfer_source_columns: request.redTransferSourceColumns ?? null,
    diff_compare_excluded_columns: request.diffCompareExcludedColumns ?? null,
    note: request.note ?? null
  };
}

function fromQueryResult(
  result: InsertTransferDestinationDefinitionQueryResult
): CreateTransferDestinationDefinitionResult {
  return ResponseSchema.parse({
    transferDestinationDefinitionId: result.transfer_destination_definition_id,
    name: result.transfer_destination_definition_name,
    description: result.description,
    destinationTableName: result.destination_table_name,
    destinationColumns: result.destination_columns,
    destinationKeyDefinition: result.destination_key_definition,
    sequenceExpressionDefinition: result.sequence_expression_definition,
    transferModel: result.transfer_model,
    signInversionColumns: result.sign_inversion_columns,
    redTransferSourceColumns: result.red_transfer_source_columns,
    diffCompareExcludedColumns: result.diff_compare_excluded_columns,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
    note: result.note
  });
}

export async function executeCreateTransferDestinationDefinitionEntrySpec(
  executor: FeatureQueryExecutor,
  rawRequest: unknown
): Promise<CreateTransferDestinationDefinitionResult> {
  const request = normalizeRequest(parseRequest(rawRequest));
  rejectRequest(request);
  const result = await executeInsertTransferDestinationDefinitionQuerySpec(executor, toQueryParams(request));
  return fromQueryResult(result);
}
