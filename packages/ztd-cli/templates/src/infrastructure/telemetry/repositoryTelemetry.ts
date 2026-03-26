import { createConsoleRepositoryTelemetry } from './consoleRepositoryTelemetry.js';
import type { RepositoryTelemetry } from './types.js';

export type {
  RepositoryTelemetry,
  RepositoryTelemetryConsoleOptions,
  RepositoryTelemetryContext,
  RepositoryTelemetryEvent,
  RepositoryTelemetryEventKind,
} from './types.js';

export { createConsoleRepositoryTelemetry } from './consoleRepositoryTelemetry.js';

export const defaultRepositoryTelemetry = createConsoleRepositoryTelemetry();

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
