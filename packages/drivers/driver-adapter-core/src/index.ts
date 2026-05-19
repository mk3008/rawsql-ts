import {
  compileNamedParameters,
  type CompileResult,
  type NamedParams,
  type PlaceholderStyle,
} from '@rawsql-ts/shared-binder';

export type SqlNamedParams = NamedParams;
export type SqlQueryParameters = readonly unknown[] | SqlNamedParams;

export type DriverQuery = {
  text: string;
  values?: readonly unknown[];
  orderedNames?: readonly string[];
};

export type SqlQueryRows<T> = Promise<T[]>;

export type SqlClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: SqlQueryParameters
  ): SqlQueryRows<T>;
};

export type CompileDriverQueryOptions = {
  placeholderStyle: PlaceholderStyle;
};

export type RowsResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  rows: T[];
};

export type RowsQueryable = {
  query(
    text: string,
    values?: readonly unknown[]
  ): Promise<RowsResult<Record<string, unknown>>>;
};

export type CreateRowsOnlySqlClientOptions = CompileDriverQueryOptions;

export function compileDriverQuery(
  text: string,
  values: SqlQueryParameters | undefined,
  options: CompileDriverQueryOptions
): DriverQuery {
  if (values === undefined) {
    return { text };
  }

  if (Array.isArray(values)) {
    return { text, values };
  }

  const compiled: CompileResult = compileNamedParameters(text, values as SqlNamedParams, options.placeholderStyle);
  return {
    text: compiled.sql,
    values: compiled.values,
    orderedNames: compiled.orderedNames,
  };
}

export function createRowsOnlySqlClient(
  queryable: RowsQueryable,
  options: CreateRowsOnlySqlClientOptions
): SqlClient {
  return {
    query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: SqlQueryParameters
    ): Promise<T[]> {
      const compiled = compileDriverQuery(text, values, options);
      return queryable.query(compiled.text, compiled.values).then((result) => result.rows as T[]);
    },
  };
}

export type { CompileResult, NamedParams, PlaceholderStyle };
