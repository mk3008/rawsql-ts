import type { SelectRewriterOptions } from '@rawsql-ts/testkit-core';
import type { SqlFormatterOptions } from 'rawsql-ts';

const POSTGRES_FORMATTER_DEFAULTS: SqlFormatterOptions = {
  parameterStyle: 'indexed',
  parameterSymbol: '$',
};

export const withPostgresFormatterDefaults = (options: SelectRewriterOptions): SelectRewriterOptions => {
  const formatterOptions: SqlFormatterOptions = {
    ...POSTGRES_FORMATTER_DEFAULTS,
    ...(options.formatterOptions ?? {}),
  };

  return {
    ...options,
    formatterOptions,
  };
};
