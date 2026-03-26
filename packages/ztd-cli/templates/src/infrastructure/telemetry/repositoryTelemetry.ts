import type { RepositoryTelemetry } from './types.js';

export type {
  RepositoryTelemetry,
  RepositoryTelemetryConsoleOptions,
  RepositoryTelemetryArrayLength,
  RepositoryTelemetryContext,
  RepositoryTelemetryEvent,
  RepositoryTelemetryEventKind,
  RepositoryTelemetryNullability,
  RepositoryTelemetryOptionalPredicatePruning,
  RepositoryTelemetryPagingTransformation,
  RepositoryTelemetryParameterKind,
  RepositoryTelemetryParameterShape,
  RepositoryTelemetryPipelineTransformation,
  RepositoryTelemetrySortTransformation,
  RepositoryTelemetryTransformations,
} from './types.js';

export { createConsoleRepositoryTelemetry } from './consoleRepositoryTelemetry.js';

/**
 * Create a repository telemetry hook that intentionally does nothing.
 *
 * The starter scaffold keeps this as the default so applications opt in to
 * console, pino, OpenTelemetry, or custom sinks explicitly.
 */
export function createNoopRepositoryTelemetry(): RepositoryTelemetry {
  return {
    emit(): void {
      return;
    }
  };
}

export const defaultRepositoryTelemetry = createNoopRepositoryTelemetry();

/**
 * Resolve the repository telemetry hook that application code wants to use.
 *
 * Repository constructors can accept an optional telemetry dependency and call
 * this helper so the default console hook works without extra setup.
 */
export function resolveRepositoryTelemetry(
  telemetry?: RepositoryTelemetry,
): RepositoryTelemetry {
  return telemetry ?? defaultRepositoryTelemetry;
}
