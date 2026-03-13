import type {
  RepositoryTelemetry,
  RepositoryTelemetryConsoleOptions,
  RepositoryTelemetryEvent,
} from './types';

/**
 * Create a conservative console-backed telemetry hook for repositories.
 *
 * The default policy keeps SQL text disabled so applications opt in before
 * query text is emitted to logs or forwarded to another sink.
 */
export function createConsoleRepositoryTelemetry(
  options: RepositoryTelemetryConsoleOptions = {},
): RepositoryTelemetry {
  const logger = options.logger ?? console;

  return {
    emit(event: RepositoryTelemetryEvent): void {
      const payload = serializeEvent(event, options.includeSqlText === true);
      if (event.kind === 'query.execute.error') {
        logger.error('[repository-telemetry]', payload);
        return;
      }

      logger.info('[repository-telemetry]', payload);
    },
  };
}

function serializeEvent(
  event: RepositoryTelemetryEvent,
  includeSqlText: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    kind: event.kind,
    timestamp: event.timestamp,
    repositoryName: event.repositoryName,
    methodName: event.methodName,
  };

  if (event.queryName) {
    payload.queryName = event.queryName;
  }
  if (event.fallback !== undefined) {
    payload.fallback = event.fallback;
  }

  // Keep SQL text out of default logs so applications make that policy choice.
  if (includeSqlText && event.sqlText) {
    payload.sqlText = event.sqlText;
  }

  if (event.kind !== 'query.execute.start') {
    payload.durationMs = event.durationMs;
  }
  if (event.kind === 'query.execute.success' && event.rowCount !== undefined) {
    payload.rowCount = event.rowCount;
  }
  if (event.kind === 'query.execute.error') {
    payload.errorName = event.errorName;
    payload.errorMessage = event.errorMessage;
  }

  return payload;
}
