import type { QuerySpecZtdCase } from '#tests/support/ztd/case-types.js';
import type {
  InsertTransferDestinationDefinitionQueryParams,
  InsertTransferDestinationDefinitionQueryResult
} from '../boundary.js';

export type InsertTransferDestinationDefinitionBeforeDb = {
  rawsql_transfer: {
    destination_definition: readonly Partial<InsertTransferDestinationDefinitionQueryResult>[];
  };
};
export type InsertTransferDestinationDefinitionInput = InsertTransferDestinationDefinitionQueryParams;
export type InsertTransferDestinationDefinitionOutput = InsertTransferDestinationDefinitionQueryResult;

export type InsertTransferDestinationDefinitionQueryBoundaryZtdCase = QuerySpecZtdCase<
  InsertTransferDestinationDefinitionBeforeDb,
  InsertTransferDestinationDefinitionInput,
  InsertTransferDestinationDefinitionOutput
>;
