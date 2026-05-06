import type { QuerySpecZtdCase } from '#tests/support/ztd/case-types.js';
import type {
  ResolveTransferDestinationDefinitionsQueryParams,
  ResolveTransferDestinationDefinitionsQueryResult
} from '../boundary.js';

export type ResolveTransferDestinationDefinitionsBeforeDb = {
  public: {
    transfer_destination_definition: readonly {
      transfer_destination_definition_id?: unknown;
      transfer_destination_definition_name?: unknown;
      description?: unknown;
      destination_table_name?: unknown;
      destination_columns?: unknown;
      destination_key_definition?: unknown;
      sequence_expression_definition?: unknown;
      transfer_model?: unknown;
      sign_inversion_columns?: unknown;
      red_transfer_source_columns?: unknown;
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
