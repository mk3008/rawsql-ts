import { z } from 'zod';

const JsonObjectSchema = z.record(z.string(), z.unknown());

const ColumnListSchema = z
  .object({
    columns: z.array(z.string().trim().min(1)),
  })
  .strict();

const SourceKeyDefinitionSchema = z
  .object({
    keys: z
      .array(
        z
          .object({
            column: z.string().trim().min(1),
            type: z.string().trim().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const DestinationKeyMappingSchema = z
  .object({
    sourceKey: z.array(z.string().trim().min(1)).min(1),
    destinationKey: z
      .array(
        z
          .object({
            name: z.string().trim().min(1),
            sourceColumn: z.string().trim().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const DestinationInputSchema = z
  .object({
    destinationDefinitionName: z.string().trim().min(1),
    executionOrder: z.number().int().positive(),
    destinationKeyMapping: DestinationKeyMappingSchema,
    mappingDefinition: JsonObjectSchema,
    diffCompareExcludedColumns: ColumnListSchema.optional(),
    isEnabled: z.boolean().optional(),
    note: z.string().trim().min(1).optional(),
  })
  .strict();

const CreateTransferSettingInputSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    sourceSqlBody: z.string().trim().min(1),
    sourceKeyDefinition: SourceKeyDefinitionSchema,
    isEnabled: z.boolean().optional(),
    note: z.string().trim().min(1).optional(),
    destinations: z.array(DestinationInputSchema).min(1),
  })
  .strict();

export type CreateTransferSettingInput = z.infer<typeof CreateTransferSettingInputSchema>;
export type CreateTransferSettingDestinationInput =
  CreateTransferSettingInput['destinations'][number];

export function parseRequest(raw: unknown): CreateTransferSettingInput {
  const request = CreateTransferSettingInputSchema.parse(raw);
  assertCreateTransferSettingInput(request);
  return request;
}

function assertCreateTransferSettingInput(request: CreateTransferSettingInput): void {
  rejectDuplicateValues(
    'destinations[].executionOrder',
    request.destinations.map((destination) => destination.executionOrder),
  );
  rejectDuplicateValues(
    'destinations[].destinationDefinitionName',
    request.destinations.map((destination) => destination.destinationDefinitionName),
  );
}

function rejectDuplicateValues(fieldName: string, values: readonly (string | number)[]): void {
  const valueSet = new Set(values);
  if (valueSet.size !== values.length) {
    throw new Error(`${fieldName} must be unique within a transfer setting.`);
  }
}
