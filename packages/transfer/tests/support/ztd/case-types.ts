export interface QuerySpecCase<
  BeforeDb extends Record<string, unknown> = Record<string, unknown>,
  Input = unknown,
  Output = unknown
> {
  name: string;
  beforeDb: BeforeDb;
  input: Input;
  output: Output;
  afterDb?: BeforeDb;
}

export type QuerySpecZtdCase<
  BeforeDb extends Record<string, unknown> = Record<string, unknown>,
  Input = unknown,
  Output = unknown
> = Omit<QuerySpecCase<BeforeDb, Input, Output>, 'afterDb'>;

export type QuerySpecTraditionalCase<
  BeforeDb extends Record<string, unknown> = Record<string, unknown>,
  Input = unknown,
  Output = unknown
> = QuerySpecCase<BeforeDb, Input, Output>;

export type ZtdCase<
  BeforeDb extends Record<string, unknown> = Record<string, unknown>,
  Input = unknown,
  Output = unknown
> = QuerySpecZtdCase<BeforeDb, Input, Output>;
