import type { QuerySpecZtdCase } from '#tests/support/ztd/case-types.js';
import type { SmokeQueryParams, SmokeQueryResult } from '../boundary.js';

export type SmokeBeforeDb = {
  public: {
    users: readonly {
      user_id?: unknown;
      email?: unknown;
      display_name?: unknown;
      is_active?: unknown;
      created_at?: unknown;
    }[];
  };
};

export type SmokeInput = SmokeQueryParams;
export type SmokeOutput = SmokeQueryResult;

export type SmokeQueryBoundaryZtdCase = QuerySpecZtdCase<SmokeBeforeDb, SmokeInput, SmokeOutput>;
