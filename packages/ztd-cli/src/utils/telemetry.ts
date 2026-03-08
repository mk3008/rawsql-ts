import { performance } from 'node:perf_hooks';

export type TelemetryAttributeValue = string | number | boolean | null;
export type TelemetryAttributes = Record<string, TelemetryAttributeValue | undefined>;
export type TelemetryStatus = 'ok' | 'error';

const TELEMETRY_ENABLED_ENV = 'ZTD_CLI_TELEMETRY';
const DEFAULT_SCHEMA_VERSION = 1;
const MAX_ATTRIBUTE_STRING_LENGTH = 160;
const REDACTED_VALUE = '[REDACTED]';

export const TELEMETRY_DECISION_EVENT_SCHEMA = {
  'command.selected': {
    summary: 'A command path was selected and root command telemetry started.',
    allowedAttributes: ['command'],
  },
  'command.completed': {
    summary: 'A command path completed successfully.',
    allowedAttributes: ['command'],
  },
  'model-gen.probe-mode': {
    summary: 'model-gen resolved whether probing should use live PostgreSQL or ZTD fixtures.',
    allowedAttributes: ['probeMode'],
  },
  'watch.invalid-with-dry-run': {
    summary: 'ztd-config rejected an invalid watch plus dry-run option combination.',
    allowedAttributes: [],
  },
  'command.options.resolved': {
    summary: 'ztd-config resolved high-level option state that influences generation flow.',
    allowedAttributes: ['dryRun', 'watch', 'quiet', 'shouldUpdateConfig', 'jsonPayload'],
  },
  'config.updated': {
    summary: 'ztd-config persisted ddl-related project configuration changes.',
    allowedAttributes: [],
  },
  'output.json-envelope': {
    summary: 'The command emitted a machine-readable JSON envelope.',
    allowedAttributes: [],
  },
  'watch.enabled': {
    summary: 'ztd-config switched into watch mode after the initial generation.',
    allowedAttributes: [],
  },
  'output.dry-run-diagnostic': {
    summary: 'The command emitted dry-run follow-up guidance instead of writing files.',
    allowedAttributes: [],
  },
  'output.next-steps-diagnostic': {
    summary: 'The command emitted next-step guidance for interactive use.',
    allowedAttributes: [],
  },
  'output.quiet-suppressed': {
    summary: 'The command intentionally suppressed follow-up guidance because quiet mode is active.',
    allowedAttributes: [],
  },
} as const;

export type TelemetryDecisionEventName = keyof typeof TELEMETRY_DECISION_EVENT_SCHEMA;

interface TelemetrySpan {
  id: string;
  end(status: TelemetryStatus): void;
  recordException(error: unknown, attributes?: TelemetryAttributes): void;
}

interface TelemetrySink {
  startSpan(name: string, parentSpanId?: string, attributes?: TelemetryAttributes): TelemetrySpan;
  emitDecisionEvent(name: TelemetryDecisionEventName, spanId?: string, attributes?: TelemetryAttributes): void;
  emitException(error: unknown, spanId?: string, attributes?: TelemetryAttributes): void;
}

class NoopTelemetrySpan implements TelemetrySpan {
  id = 'noop';

  end(): void {
    return;
  }

  recordException(): void {
    return;
  }
}

class NoopTelemetrySink implements TelemetrySink {
  startSpan(): TelemetrySpan {
    return new NoopTelemetrySpan();
  }

  emitDecisionEvent(): void {
    return;
  }

  emitException(): void {
    return;
  }
}

class StderrTelemetrySink implements TelemetrySink {
  private nextSpanId = 1;

  startSpan(name: string, parentSpanId?: string, attributes?: TelemetryAttributes): TelemetrySpan {
    const spanId = `span-${this.nextSpanId++}`;
    const startedAt = performance.now();

    this.write({
      kind: 'span-start',
      spanId,
      parentSpanId,
      spanName: name,
      attributes: sanitizeAttributes(attributes),
    });

    return {
      id: spanId,
      end: (status: TelemetryStatus) => {
        this.write({
          kind: 'span-end',
          spanId,
          parentSpanId,
          spanName: name,
          status,
          durationMs: roundDuration(performance.now() - startedAt),
        });
      },
      recordException: (error: unknown, exceptionAttributes?: TelemetryAttributes) => {
        this.emitException(error, spanId, exceptionAttributes);
      },
    };
  }

  emitDecisionEvent(name: TelemetryDecisionEventName, spanId?: string, attributes?: TelemetryAttributes): void {
    const schema = TELEMETRY_DECISION_EVENT_SCHEMA[name];
    this.write({
      kind: 'decision',
      eventName: name,
      spanId,
      attributes: sanitizeAttributes(attributes, schema.allowedAttributes),
    });
  }

  emitException(error: unknown, spanId?: string, attributes?: TelemetryAttributes): void {
    this.write({
      kind: 'exception',
      spanId,
      error: normalizeError(error),
      attributes: sanitizeAttributes(attributes),
    });
  }

  private write(payload: Record<string, unknown>): void {
    process.stderr.write(
      `${JSON.stringify({
        schemaVersion: DEFAULT_SCHEMA_VERSION,
        type: 'telemetry',
        timestamp: new Date().toISOString(),
        ...payload,
      })}\n`,
    );
  }
}

const NOOP_SINK = new NoopTelemetrySink();

let telemetrySink: TelemetrySink = NOOP_SINK;
let telemetryEnabled = false;
const spanStack: TelemetrySpan[] = [];

export function resolveTelemetryEnabled(explicit?: boolean | string | undefined): boolean {
  if (typeof explicit === 'boolean') {
    return explicit;
  }

  if (typeof explicit === 'string') {
    return isTruthy(explicit);
  }

  return isTruthy(process.env[TELEMETRY_ENABLED_ENV]);
}

export function setTelemetryEnabled(enabled: boolean): void {
  process.env[TELEMETRY_ENABLED_ENV] = enabled ? '1' : '0';
}

export function configureTelemetry(options: { enabled?: boolean | string } = {}): void {
  telemetryEnabled = resolveTelemetryEnabled(options.enabled);
  telemetrySink = telemetryEnabled ? new StderrTelemetrySink() : NOOP_SINK;
  spanStack.length = 0;
}

export function isTelemetryEnabled(): boolean {
  return telemetryEnabled;
}

export function beginCommandSpan(commandName: string, attributes: TelemetryAttributes = {}): void {
  if (!telemetryEnabled) {
    return;
  }

  spanStack.length = 0;
  const rootSpan = telemetrySink.startSpan(commandName, undefined, {
    ...attributes,
    scope: 'command-root',
  });
  spanStack.push(rootSpan);
}

export function finishCommandSpan(status: TelemetryStatus = 'ok'): void {
  if (!telemetryEnabled) {
    return;
  }

  while (spanStack.length > 1) {
    spanStack.pop()?.end(status);
  }

  spanStack.pop()?.end(status);
}

export async function withSpan<T>(name: string, fn: () => Promise<T> | T, attributes: TelemetryAttributes = {}): Promise<T> {
  if (!telemetryEnabled) {
    return await fn();
  }

  const parentSpanId = getCurrentSpan()?.id;
  const span = telemetrySink.startSpan(name, parentSpanId, attributes);
  spanStack.push(span);

  try {
    const result = await fn();
    span.end('ok');
    return result;
  } catch (error) {
    span.recordException(error);
    span.end('error');
    throw error;
  } finally {
    removeSpan(span.id);
  }
}

export function withSpanSync<T>(name: string, fn: () => T, attributes: TelemetryAttributes = {}): T {
  if (!telemetryEnabled) {
    return fn();
  }

  const parentSpanId = getCurrentSpan()?.id;
  const span = telemetrySink.startSpan(name, parentSpanId, attributes);
  spanStack.push(span);

  try {
    const result = fn();
    span.end('ok');
    return result;
  } catch (error) {
    span.recordException(error);
    span.end('error');
    throw error;
  } finally {
    removeSpan(span.id);
  }
}

export function emitDecisionEvent(name: TelemetryDecisionEventName, attributes: TelemetryAttributes = {}): void {
  if (!telemetryEnabled) {
    return;
  }

  telemetrySink.emitDecisionEvent(name, getCurrentSpan()?.id, attributes);
}

export function recordException(error: unknown, attributes: TelemetryAttributes = {}): void {
  if (!telemetryEnabled) {
    return;
  }

  const currentSpan = getCurrentSpan();
  if (currentSpan) {
    currentSpan.recordException(error, attributes);
    return;
  }

  telemetrySink.emitException(error, undefined, attributes);
}

function getCurrentSpan(): TelemetrySpan | undefined {
  return spanStack[spanStack.length - 1];
}

function removeSpan(spanId: string): void {
  const index = spanStack.findIndex((span) => span.id === spanId);
  if (index >= 0) {
    spanStack.splice(index, 1);
  }
}

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function sanitizeAttributes(
  attributes: TelemetryAttributes = {},
  allowedKeys?: readonly string[],
): Record<string, TelemetryAttributeValue> {
  const sanitized: Record<string, TelemetryAttributeValue> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) {
      continue;
    }
    if (allowedKeys && !allowedKeys.includes(key)) {
      continue;
    }

    sanitized[key] = sanitizeAttributeValue(key, value);
  }
  return sanitized;
}

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeStringValue('message', error.message),
    };
  }

  return {
    name: 'UnknownError',
    message: sanitizeStringValue('message', String(error)),
  };
}

function sanitizeAttributeValue(key: string, value: TelemetryAttributeValue): TelemetryAttributeValue {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return isSensitiveAttributeKey(key) ? REDACTED_VALUE : value;
  }

  return sanitizeStringValue(key, value);
}

// Telemetry safety policy intentionally distinguishes secrets from bulky but benign data. DSN detection covers both URL-style and libpq-style forms, while oversized or multiline values are truncated instead of redacted so exporters keep the boundary without leaking payload bodies.
function sanitizeStringValue(key: string, value: string): string {
  if (isSensitiveAttributeKey(key) || looksSensitive(value)) {
    return REDACTED_VALUE;
  }

  if (value.includes('\n') || value.length > MAX_ATTRIBUTE_STRING_LENGTH) {
    return `[TRUNCATED:${value.length}]`;
  }

  return value;
}

function isSensitiveAttributeKey(key: string): boolean {
  return [
    /(?:^|\.)(?:sql|sqlText|query|queryText|statement)$/iu,
    /(?:dsn|databaseUrl|connectionUrl|url|uri)$/iu,
    /(?:password|secret|credential|authorization|api(?:_|-)?key|access(?:_|-)?key|(?:auth|bearer|access|refresh|session)?token)$/iu,
    /(?:bindValue|bindValues|paramValue|paramValues)$/iu,
    /(?:stack|dump)$/iu,
  ].some((pattern) => pattern.test(key));
}

function looksSensitive(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }

  return [
    /\b(?:postgres(?:ql)?|mysql|mssql|redis):\/\/\S+/iu,
    /\b(?:host|hostaddr|port|dbname|db|user|password|passfile|service|sslmode|sslcert|sslkey|sslrootcert|target_session_attrs)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+)/iu,
    /\b(?:password|pwd|secret|token|api(?:key|_key)|access(?:key|_key)|authorization)\s*[=:]\s*\S+/iu,
    /\b(?:bearer|basic)\s+[A-Za-z0-9._~+\/=:-]{8,}\b/iu,
    /\b(?:select|insert|update|delete|create|alter|drop|with)\b[\s\S]{0,120}\b(?:from|into|table|view|where|values|set)\b/iu,
  ].some((pattern) => pattern.test(normalized));
}

function roundDuration(value: number): number {
  return Math.round(value * 1000) / 1000;
}
