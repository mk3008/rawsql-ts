export interface QuerySpecZtdCase<
  BeforeDb extends Record<string, unknown> = Record<string, unknown>,
  Input = unknown,
  Output = unknown,
  AfterDb extends Record<string, unknown> = BeforeDb
> {
  name: string;
  beforeDb: BeforeDb;
  input: Input;
  output: Output;
  afterDb?: AfterDb;
}

export type ZtdCase<
  BeforeDb extends Record<string, unknown> = Record<string, unknown>,
  Input = unknown,
  Output = unknown,
  AfterDb extends Record<string, unknown> = BeforeDb
> = QuerySpecZtdCase<BeforeDb, Input, Output, AfterDb>;
