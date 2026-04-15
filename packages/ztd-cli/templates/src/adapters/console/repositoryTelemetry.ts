import type {
  RepositoryTelemetry,
  RepositoryTelemetryConsoleOptions,
  RepositoryTelemetryEvent,
} from '../../libraries/telemetry/types.js';

/**
 * Create a conservative console-backed telemetry hook for repositories.
 *
 * The emitted payload stays on the safe side of the boundary: it includes the
 * runtime contract metadata, but never SQL text or bind values.
 */
export function createConsoleRepositoryTelemetry(
  options: RepositoryTelemetryConsoleOptions = {},
): RepositoryTelemetry {
  const logger = options.logger ?? console;

  return {
    emit(event: RepositoryTelemetryEvent): void {
      const payload = serializeEvent(event);
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
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    kind: event.kind,
    timestamp: event.timestamp,
    queryId: event.queryId,
    repositoryName: event.repositoryName,
    methodName: event.methodName,
    paramsShape: event.paramsShape,
    transformations: event.transformations
  };

  if (event.kind !== 'query.execute.start') {
    payload.durationMs = event.durationMs;
  }
  if (event.kind === 'query.execute.success' && event.rowCount !== undefined) {
    payload.rowCount = event.rowCount;
  }
  if (event.kind === 'query.execute.error') {
    payload.errorName = event.errorName;
  }

  return payload;
}
