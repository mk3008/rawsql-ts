export type RepositoryTelemetryEventKind =
  | 'query.execute.start'
  | 'query.execute.success'
  | 'query.execute.error';

export interface RepositoryTelemetryContext {
  repositoryName: string;
  methodName: string;
  queryName?: string;
  sqlText?: string;
  fallback?: boolean;
}

interface RepositoryTelemetryEventBase extends RepositoryTelemetryContext {
  kind: RepositoryTelemetryEventKind;
  timestamp: string;
}

export interface RepositoryQueryExecuteStartEvent extends RepositoryTelemetryEventBase {
  kind: 'query.execute.start';
}

export interface RepositoryQueryExecuteSuccessEvent extends RepositoryTelemetryEventBase {
  kind: 'query.execute.success';
  durationMs: number;
  rowCount?: number;
}

export interface RepositoryQueryExecuteErrorEvent extends RepositoryTelemetryEventBase {
  kind: 'query.execute.error';
  durationMs: number;
  errorName: string;
  errorMessage: string;
}

export type RepositoryTelemetryEvent =
  | RepositoryQueryExecuteStartEvent
  | RepositoryQueryExecuteSuccessEvent
  | RepositoryQueryExecuteErrorEvent;

export interface RepositoryTelemetry {
  emit(event: RepositoryTelemetryEvent): void | Promise<void>;
}

export interface RepositoryTelemetryConsoleOptions {
  includeSqlText?: boolean;
  logger?: Pick<Console, 'info' | 'error'>;
}
