import type { QuerySpecZtdCase } from '#tests/support/ztd/case-types.js';

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

export type SmokeInput = { user_id: unknown };
export type SmokeOutput = { user_id: unknown; email: unknown };
export type SmokeAfterDb = SmokeBeforeDb;

export type SmokeQueryBoundaryZtdCase = QuerySpecZtdCase<
  SmokeBeforeDb,
  SmokeInput,
  SmokeOutput,
  SmokeAfterDb
>;
