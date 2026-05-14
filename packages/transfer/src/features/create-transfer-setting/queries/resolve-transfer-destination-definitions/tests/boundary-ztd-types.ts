import type { QuerySpecZtdCase } from '#tests/support/ztd/case-types.js';
import type {
  ResolveTransferDestinationDefinitionsQueryParams,
  ResolveTransferDestinationDefinitionsQueryResult
} from '../boundary.js';

export type ResolveTransferDestinationDefinitionsBeforeDb = {
  rawsql_transfer: {
    destination_definition: readonly {
      destination_definition_id?: unknown;
      destination_definition_name?: unknown;
      description?: unknown;
      destination_table_name?: unknown;
      destination_columns?: unknown;
      destination_key_columns?: unknown;
      sequence_expression_definition?: unknown;
      transfer_model?: unknown;
      sign_inversion_columns?: unknown;
      generated_red_transfer_sql_body?: unknown;
      generated_red_transfer_sql_status?: unknown;
      generated_red_transfer_sql_error?: unknown;
      created_at?: unknown;
      updated_at?: unknown;
      note?: unknown;
    }[];
  };
};
export type ResolveTransferDestinationDefinitionsInput = ResolveTransferDestinationDefinitionsQueryParams;
export type ResolveTransferDestinationDefinitionsOutput = ResolveTransferDestinationDefinitionsQueryResult;

export type ResolveTransferDestinationDefinitionsQueryBoundaryZtdCase = QuerySpecZtdCase<
  ResolveTransferDestinationDefinitionsBeforeDb,
  ResolveTransferDestinationDefinitionsInput,
  ResolveTransferDestinationDefinitionsOutput
>;
