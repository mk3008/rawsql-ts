export type RepositoryTelemetryEventKind =
  | 'query.execute.start'
  | 'query.execute.success'
  | 'query.execute.error';

export type RepositoryTelemetryParameterKind = 'scalar' | 'array' | 'null' | 'unknown';
export type RepositoryTelemetryNullability = 'null' | 'non-null' | 'mixed';
export type RepositoryTelemetryArrayLength = 'empty' | 'single' | 'few' | 'many' | 'unknown';

export interface RepositoryTelemetryParameterShape {
  name: string;
  kind: RepositoryTelemetryParameterKind;
  nullability: RepositoryTelemetryNullability;
  arrayLength?: RepositoryTelemetryArrayLength;
}

export interface RepositoryTelemetryOptionalPredicatePruning {
  enabled: boolean;
  prunedPredicateCount?: number;
}

export interface RepositoryTelemetryPagingTransformation {
  enabled: boolean;
  hasLimit?: boolean;
  hasOffset?: boolean;
}

export interface RepositoryTelemetrySortTransformation {
  enabled: boolean;
  orderByCount?: number;
}

export interface RepositoryTelemetryPipelineTransformation {
  enabled: boolean;
  stageCount?: number;
}

export interface RepositoryTelemetryTransformations {
  optionalPredicatePruning?: RepositoryTelemetryOptionalPredicatePruning;
  paging?: RepositoryTelemetryPagingTransformation;
  sort?: RepositoryTelemetrySortTransformation;
  pipelineDecomposition?: RepositoryTelemetryPipelineTransformation;
}

export interface RepositoryTelemetryContext {
  queryId: string;
  repositoryName: string;
  methodName: string;
  paramsShape: RepositoryTelemetryParameterShape[];
  transformations: RepositoryTelemetryTransformations;
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
  logger?: Pick<Console, 'info' | 'error'>;
}
