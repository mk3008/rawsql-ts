import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import type { FeatureQueryExecutor } from '#features/_shared/featureQueryExecutor.js';
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
  destination_definition_id: z.coerce.string(),
  destination_definition_name: z.string()
}).strict();

const QueryResultSchema = z.object({
  items: z.array(RowSchema)
}).strict();

export type ResolveTransferDestinationDefinitionsQueryResult = z.infer<typeof QueryResultSchema>;
export type ResolveTransferDestinationDefinitionsRow = z.infer<typeof RowSchema>;

function parseQueryParams(raw: unknown): ResolveTransferDestinationDefinitionsQueryParams {
  return QueryParamsSchema.parse(raw);
}

export async function executeResolveTransferDestinationDefinitionsQuerySpec(
  executor: FeatureQueryExecutor,
  rawParams: unknown
): Promise<ResolveTransferDestinationDefinitionsQueryResult> {
  const params = parseQueryParams(rawParams);
  const rows = await executor.query<ResolveTransferDestinationDefinitionsRow>(
    resolveTransferDestinationDefinitionsSqlResource,
    params
  );
  return mapResolveTransferDestinationDefinitionsRowsToResult(rows);
}
