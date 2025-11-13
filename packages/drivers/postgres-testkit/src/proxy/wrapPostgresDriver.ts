import { SelectFixtureRewriter } from '@rawsql-ts/testkit-core';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import type { QueryConfig } from 'pg';
import type {
  PostgresConnectionLike,
  PostgresQueryCallback,
  WrapPostgresDriverOptions,
  WrappedPostgresDriver,
  WrappedPostgresQueryLogEntry,
} from '../types';

const normalizePostgresQueryArgs = (
  args: unknown[]
): {
  text: string;
  values?: unknown[];
  callback?: PostgresQueryCallback;
  isConfig: boolean;
  config?: QueryConfig;
  buildArgs(rewrittenText?: string): unknown[];
} => {
  const [textOrConfig, valuesOrCallback, maybeCallback] = args;
  let text = '';
  let values: unknown[] | undefined;
  let callback: PostgresQueryCallback | undefined;
  let config: QueryConfig | undefined;
  let isConfig = false;

  if (typeof textOrConfig === 'object' && textOrConfig !== null && 'text' in textOrConfig) {
    // Handle the QueryConfig overload by keeping a reference to the original config.
    config = textOrConfig as QueryConfig;
    text = config.text;
    isConfig = true;
    values = config.values;
    if (typeof valuesOrCallback === 'function') {
      callback = valuesOrCallback;
    }
  } else {
    // Treat the string overload and distinguish between params arrays and callbacks.
    text = typeof textOrConfig === 'string' ? textOrConfig : '';
    if (Array.isArray(valuesOrCallback)) {
      values = valuesOrCallback;
      if (typeof maybeCallback === 'function') {
        callback = maybeCallback;
      }
    } else if (typeof valuesOrCallback === 'function') {
      callback = valuesOrCallback;
    }
  }

  return {
    text,
    values,
    callback,
    isConfig,
    config,
    buildArgs(rewrittenText = text) {
      if (isConfig && config) {
        // Clone the config so we only modify the rewritten text.
        const rewrittenConfig: QueryConfig = { ...config, text: rewrittenText };
        return callback ? [rewrittenConfig, callback] : [rewrittenConfig];
      }

      const reconstructed: unknown[] = [rewrittenText];
      if (values !== undefined) {
        reconstructed.push(values);
      }
      if (callback) {
        reconstructed.push(callback);
      }
      return reconstructed;
    },
  };
};

const isSelectableQuery = (sql: string): boolean => {
  const trimmed = sql.trimStart();
  if (trimmed.length === 0) {
    return false;
  }

  const upper = trimmed.toUpperCase();
  if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
    return true;
  }

  if (upper.startsWith('EXPLAIN')) {
    return /\bSELECT\b/i.test(upper);
  }

  return false;
};

export const wrapPostgresDriver = <T extends PostgresConnectionLike>(
  driver: T,
  options: WrapPostgresDriverOptions
): WrappedPostgresDriver<T> => {
  const rewriter = new SelectFixtureRewriter(options);

  const buildProxy = (scopedFixtures?: TableFixture[]): WrappedPostgresDriver<T> => {
    const queryLog: WrappedPostgresQueryLogEntry[] | undefined = options.recordQueries ? [] : undefined;
    const shouldObserve = Boolean(options.onExecute || queryLog);

    const handleExecution = (sql: string, params?: unknown[]): void => {
      // Skip instrumentation when no observers were configured.
      if (!shouldObserve) {
        return;
      }
      options.onExecute?.(sql, params);
      queryLog?.push({ method: 'query', sql, params });
    };

    // Proxy the driver so we can hook `query` while leaving other members untouched.
    return new Proxy(driver, {
      get(target, prop, receiver) {
        if (prop === 'withFixtures') {
          return (fixtures: TableFixture[]) => buildProxy(fixtures);
        }

        if (prop === 'queries') {
          return queryLog;
        }

        const value = Reflect.get(target, prop, receiver);
        if (prop !== 'query' || typeof value !== 'function') {
          return typeof value === 'function' ? value.bind(target) : value;
        }

        return (...args: unknown[]) => {
          const normalized = normalizePostgresQueryArgs(args);
          if (!isSelectableQuery(normalized.text)) {
            // Pass through non-select statements untouched.
            return value.apply(target, normalized.buildArgs());
          }

          const context = scopedFixtures ? { fixtures: scopedFixtures } : undefined;
          // Rewrite SELECT queries before they reach the real driver.
          const rewritten = rewriter.rewrite(normalized.text, context);
          handleExecution(rewritten.sql, normalized.values);
          return value.apply(target, normalized.buildArgs(rewritten.sql));
        };
      },
    }) as WrappedPostgresDriver<T>;
  };

  return buildProxy();
};
