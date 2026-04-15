export type RepositoryTelemetryEventKind =
  | 'query.execute.start'
  | 'query.execute.success'
  | 'query.execute.error';

export type RepositoryTelemetryPresence = 'present' | 'absent';
export type RepositoryTelemetryParameterKind = 'scalar' | 'array' | 'object' | 'unknown';
export type RepositoryTelemetryNullability = 'null' | 'non-null' | 'mixed' | 'unknown';
export type RepositoryTelemetryArrayLength = 'empty' | 'single' | 'few' | 'many' | 'unknown';
export type RepositoryTelemetryBooleanValue = 'true' | 'false';

type RepositoryTelemetryScalarParameterShape = {
  name: string;
  presence: 'present';
  kind: 'scalar';
  isNull: false;
  nullability: 'non-null';
  isEmptyString?: boolean;
  booleanValue?: RepositoryTelemetryBooleanValue;
  arrayLength?: never;
  isEmptyArray?: never;
  operator?: string;
};

type RepositoryTelemetryArrayParameterShape =
  | {
      name: string;
      presence: 'present';
      kind: 'array';
      isNull: false;
      nullability: Exclude<RepositoryTelemetryNullability, 'null' | 'unknown'>;
      arrayLength: RepositoryTelemetryArrayLength;
      isEmptyArray: boolean;
      isEmptyString?: never;
      booleanValue?: never;
      operator?: string;
    }
  | {
      name: string;
      presence: 'present';
      kind: 'array';
      isNull: true;
      nullability: 'null';
      arrayLength?: never;
      isEmptyArray?: never;
      isEmptyString?: never;
      booleanValue?: never;
      operator?: string;
    };

type RepositoryTelemetryNullParameterShape = {
  name: string;
  presence: 'present';
  kind: 'scalar' | 'object' | 'unknown';
  isNull: true;
  nullability: 'null';
  arrayLength?: never;
  isEmptyArray?: never;
  isEmptyString?: never;
  booleanValue?: never;
  operator?: string;
};

type RepositoryTelemetryUnknownParameterShape =
  | {
      name: string;
      presence: 'absent';
      kind: 'unknown';
      isNull: false;
      nullability: 'unknown';
      arrayLength?: never;
      isEmptyArray?: never;
      isEmptyString?: never;
      booleanValue?: never;
      operator?: string;
    }
  | {
      name: string;
      presence: 'present';
      kind: 'object' | 'unknown';
      isNull: false;
      nullability: Exclude<RepositoryTelemetryNullability, 'null'>;
      arrayLength?: never;
      isEmptyArray?: never;
      isEmptyString?: never;
      booleanValue?: never;
      operator?: string;
    };

export type RepositoryTelemetryParameterShape =
  | RepositoryTelemetryScalarParameterShape
  | RepositoryTelemetryArrayParameterShape
  | RepositoryTelemetryNullParameterShape
  | RepositoryTelemetryUnknownParameterShape;

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
