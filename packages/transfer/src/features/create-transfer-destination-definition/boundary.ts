import { z } from 'zod';
import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';

import {
  executeInsertTransferDestinationDefinitionQuerySpec,
  type InsertTransferDestinationDefinitionQueryParams,
  type InsertTransferDestinationDefinitionQueryResult,
} from './queries/insert-transfer-destination-definition/boundary.js';

const TRANSFER_MODELS = ['immutable', 'mutable'] as const;

const DestinationColumnSchema = z
  .object({
    name: z.string().trim().min(1),
    type: z.string().trim().min(1),
  })
  .strict();

const DestinationColumnsSchema = z
  .object({
    columns: z.array(DestinationColumnSchema),
  })
  .strict();

const ColumnNameArraySchema = z.array(z.string().trim().min(1));

const RequestSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    destinationTableName: z
      .string()
      .trim()
      .min(1)
      .refine(
        (value) => isFullyQualifiedTableName(value),
        'destinationTableName must be a fully qualified table name, such as public.journal.',
      ),
    destinationColumns: DestinationColumnsSchema,
    destinationKeyColumns: ColumnNameArraySchema,
    sequenceExpressionDefinition: z.record(z.string(), z.string().trim().min(1)).optional(),
    transferModel: z.enum(TRANSFER_MODELS),
    signInversionColumns: ColumnNameArraySchema.optional(),
    note: z.string().trim().min(1).optional(),
  })
  .strict();

export type CreateTransferDestinationDefinitionInput = z.infer<typeof RequestSchema>;

const ResponseSchema = z
  .object({
    transferDestinationDefinitionId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    destinationTableName: z.string(),
    destinationColumns: DestinationColumnsSchema,
    destinationKeyColumns: ColumnNameArraySchema,
    sequenceExpressionDefinition: z.record(z.string(), z.string()).nullable(),
    transferModel: z.enum(TRANSFER_MODELS),
    signInversionColumns: ColumnNameArraySchema.nullable(),
    generatedRedTransferSqlBody: z.string(),
    generatedRedTransferSqlStatus: z.enum(['not_generated', 'success', 'failed']),
    generatedRedTransferSqlError: z.string().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    note: z.string().nullable(),
  })
  .strict();

export type CreateTransferDestinationDefinitionResult = z.infer<typeof ResponseSchema>;

function isFullyQualifiedTableName(value: string): boolean {
  const trimmedValue = value.trim();
  const parts = trimmedValue.split('.');
  return parts.length === 2 && parts.every((part) => part.length > 0);
}

function parseRequest(raw: unknown): CreateTransferDestinationDefinitionInput {
  return RequestSchema.parse(raw);
}

function normalizeRequest(
  request: CreateTransferDestinationDefinitionInput,
): CreateTransferDestinationDefinitionInput {
  return {
    ...request,
    destinationColumns: {
      columns: request.destinationColumns.columns.map((column) => ({ ...column })),
    },
    destinationKeyColumns: [...request.destinationKeyColumns],
    sequenceExpressionDefinition:
      request.sequenceExpressionDefinition === undefined
        ? undefined
        : { ...request.sequenceExpressionDefinition },
    signInversionColumns:
      request.signInversionColumns === undefined
        ? undefined
        : [...request.signInversionColumns],
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
  if (request.destinationKeyColumns.length === 0) {
    throw new Error('destinationKeyColumns must contain at least one key column.');
  }

  rejectUnknownColumnReferences(
    'destinationKeyColumns',
    request.destinationKeyColumns,
    destinationColumnNameSet,
  );
  rejectUnknownColumnReferences(
    'sequenceExpressionDefinition',
    Object.keys(request.sequenceExpressionDefinition ?? {}),
    destinationColumnNameSet,
  );
  rejectUnknownColumnReferences(
    'signInversionColumns',
    request.signInversionColumns ?? [],
    destinationColumnNameSet,
  );
}

function rejectUnknownColumnReferences(
  fieldName: string,
  referencedColumns: string[],
  destinationColumnNameSet: ReadonlySet<string>,
): void {
  const unknownColumns = referencedColumns.filter(
    (columnName) => !destinationColumnNameSet.has(columnName),
  );
  if (unknownColumns.length > 0) {
    throw new Error(
      `${fieldName} references unknown destination columns: ${unknownColumns.join(', ')}.`,
    );
  }
}

function toQueryParams(
  request: CreateTransferDestinationDefinitionInput,
): InsertTransferDestinationDefinitionQueryParams {
  return {
    destination_definition_name: request.name,
    description: request.description ?? null,
    destination_table_name: request.destinationTableName,
    destination_columns: request.destinationColumns,
    destination_key_columns: request.destinationKeyColumns,
    sequence_expression_definition: request.sequenceExpressionDefinition ?? null,
    transfer_model: request.transferModel,
    sign_inversion_columns: request.signInversionColumns ?? null,
    note: request.note ?? null,
  };
}

function fromQueryResult(
  result: InsertTransferDestinationDefinitionQueryResult,
): CreateTransferDestinationDefinitionResult {
  return ResponseSchema.parse({
    transferDestinationDefinitionId: result.destination_definition_id,
    name: result.destination_definition_name,
    description: result.description,
    destinationTableName: result.destination_table_name,
    destinationColumns: result.destination_columns,
    destinationKeyColumns: result.destination_key_columns,
    sequenceExpressionDefinition: result.sequence_expression_definition,
    transferModel: result.transfer_model,
    signInversionColumns: result.sign_inversion_columns,
    generatedRedTransferSqlBody: result.generated_red_transfer_sql_body,
    generatedRedTransferSqlStatus: result.generated_red_transfer_sql_status,
    generatedRedTransferSqlError: result.generated_red_transfer_sql_error,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
    note: result.note,
  });
}

export async function executeCreateTransferDestinationDefinitionEntrySpec(
  executor: FeatureQueryExecutor,
  rawRequest: unknown,
): Promise<CreateTransferDestinationDefinitionResult> {
  const request = normalizeRequest(parseRequest(rawRequest));
  rejectRequest(request);
  const result = await executeInsertTransferDestinationDefinitionQuerySpec(
    executor,
    toQueryParams(request),
  );
  return fromQueryResult(result);
}
