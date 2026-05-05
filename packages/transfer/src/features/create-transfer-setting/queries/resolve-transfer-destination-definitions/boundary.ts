import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import type { FeatureQueryExecutor } from '#features/_shared/featureQueryExecutor.js';
import { createCatalogExecutor, type QuerySpec } from '@rawsql-ts/sql-contract';
import { loadSqlResource } from '#features/_shared/loadSqlResource.js';
import { mapResolveTransferDestinationDefinitionsRowsToResult } from './generated/row-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolveTransferDestinationDefinitionsSqlResource = loadSqlResource(
  __dirname,
  'resolve-transfer-destination-definitions.sql'
);

const QueryParamsSchema = z.object({
  destination_definition_names: z.array(z.string().min(1)).min(1)
}).strict();

export type ResolveTransferDestinationDefinitionsQueryParams = z.infer<typeof QueryParamsSchema>;

const RowSchema = z.object({
  transfer_destination_definition_id: z.coerce.string(),
  transfer_destination_definition_name: z.string()
}).strict();

const QueryResultSchema = z.object({
  items: z.array(RowSchema)
}).strict();

export type ResolveTransferDestinationDefinitionsQueryResult = z.infer<typeof QueryResultSchema>;
export type ResolveTransferDestinationDefinitionsRow = z.infer<typeof RowSchema>;

function parseQueryParams(raw: unknown): ResolveTransferDestinationDefinitionsQueryParams {
  return QueryParamsSchema.parse(raw);
}

function parseRow(raw: unknown): ResolveTransferDestinationDefinitionsRow {
  return RowSchema.parse(raw);
}

const resolveTransferDestinationDefinitionsCatalogSpec: QuerySpec<
  ResolveTransferDestinationDefinitionsQueryParams,
  ResolveTransferDestinationDefinitionsRow
> = {
  id: 'src/features/create-transfer-setting/queries/resolve-transfer-destination-definitions/spec',
  sqlFile: 'resolve-transfer-destination-definitions.sql',
  params: {
    shape: 'named',
    example: {
      destination_definition_names: ['journal']
    }
  },
  output: {
    validate: (row) => parseRow(row),
    example: RowSchema.parse({
      transfer_destination_definition_id: '1',
      transfer_destination_definition_name: 'journal'
    })
  }
};

export async function executeResolveTransferDestinationDefinitionsQuerySpec(
  executor: FeatureQueryExecutor,
  rawParams: unknown
): Promise<ResolveTransferDestinationDefinitionsQueryResult> {
  const params = parseQueryParams(rawParams);
  const catalog = createCatalogExecutor({
    loader: {
      load: async () => resolveTransferDestinationDefinitionsSqlResource
    },
    executor: (sql, queryParams) => executor.query<Record<string, unknown>>(sql, queryParams as Record<string, unknown>),
    allowNamedParamsWithoutBinder: true
  });
  const rows = await catalog.list(resolveTransferDestinationDefinitionsCatalogSpec, params);
  return mapResolveTransferDestinationDefinitionsRowsToResult(rows);
}
