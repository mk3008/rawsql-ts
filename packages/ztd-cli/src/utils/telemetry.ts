import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';

export type TelemetryAttributeValue = string | number | boolean | null;
export type TelemetryAttributes = Record<string, TelemetryAttributeValue | undefined>;
export type TelemetryStatus = 'ok' | 'error';
export type TelemetryExportMode = 'console' | 'debug' | 'file' | 'otlp';

const TELEMETRY_ENABLED_ENV = 'ZTD_CLI_TELEMETRY';
const TELEMETRY_EXPORT_ENV = 'ZTD_CLI_TELEMETRY_EXPORT';
const TELEMETRY_FILE_ENV = 'ZTD_CLI_TELEMETRY_FILE';
const TELEMETRY_OTLP_ENDPOINT_ENV = 'ZTD_CLI_TELEMETRY_OTLP_ENDPOINT';
const DEFAULT_SCHEMA_VERSION = 1;
const DEFAULT_OTLP_HTTP_ENDPOINT = 'http://127.0.0.1:4318/v1/traces';
const DEFAULT_FILE_EXPORT_PATH = 'tmp/telemetry/ztd-cli.telemetry.jsonl';
const MAX_ATTRIBUTE_STRING_LENGTH = 160;
const REDACTED_VALUE = '[REDACTED]';
const OTLP_STATUS_OK = 1;
const OTLP_STATUS_ERROR = 2;

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
  flush(): Promise<void>;
}

interface TelemetryEnvelopeBase {
  schemaVersion: number;
  type: 'telemetry';
  timestamp: string;
}

type TelemetryEnvelope = TelemetryEnvelopeBase & Record<string, unknown>;

interface OtlpSpanEventRecord {
  timeUnixNano: string;
  name: string;
  attributes: Array<Record<string, unknown>>;
}

interface ActiveOtlpSpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  attributes: Array<Record<string, unknown>>;
  events: OtlpSpanEventRecord[];
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

  async flush(): Promise<void> {
    return;
  }
}

class JsonLinesTelemetrySink implements TelemetrySink {
  private nextSpanId = 1;

  constructor(private readonly writeLine: (line: string) => void) {}

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

  async flush(): Promise<void> {
    return;
  }

  private write(payload: Record<string, unknown>): void {
    this.writeLine(JSON.stringify(buildTelemetryEnvelope(payload)));
  }
}

class DebugTelemetrySink implements TelemetrySink {
  private nextSpanId = 1;

  startSpan(name: string, parentSpanId?: string, attributes?: TelemetryAttributes): TelemetrySpan {
    const spanId = `span-${this.nextSpanId++}`;
    const startedAt = performance.now();
    this.write('span-start', name, spanId, parentSpanId, sanitizeAttributes(attributes));

    return {
      id: spanId,
      end: (status: TelemetryStatus) => {
        this.write('span-end', name, spanId, parentSpanId, {
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
    this.write('decision', name, spanId, undefined, sanitizeAttributes(attributes, schema.allowedAttributes));
  }

  emitException(error: unknown, spanId?: string, attributes?: TelemetryAttributes): void {
    this.write('exception', normalizeError(error).message as string, spanId, undefined, sanitizeAttributes(attributes));
  }

  async flush(): Promise<void> {
    return;
  }

  private write(kind: string, label: string, spanId?: string, parentSpanId?: string, data: Record<string, unknown> = {}): void {
    const summary = JSON.stringify(data);
    const suffix = summary === '{}' ? '' : ` ${summary}`;
    const parent = parentSpanId ? ` parent=${parentSpanId}` : '';
    process.stderr.write(`[telemetry] ${kind} ${label} span=${spanId ?? 'none'}${parent}${suffix}\n`);
  }
}

class OtlpHttpTelemetrySink implements TelemetrySink {
  private readonly activeSpans = new Map<string, ActiveOtlpSpanRecord>();
  private readonly pendingExports = new Set<Promise<void>>();

  constructor(private readonly endpoint: string) {}

  startSpan(name: string, parentSpanId?: string, attributes?: TelemetryAttributes): TelemetrySpan {
    const parentSpan = parentSpanId ? this.activeSpans.get(parentSpanId) : undefined;
    const spanId = randomBytes(8).toString('hex');
    const spanRecord: ActiveOtlpSpanRecord = {
      traceId: parentSpan?.traceId ?? randomBytes(16).toString('hex'),
      spanId,
      parentSpanId,
      name,
      startTimeUnixNano: currentTimeUnixNano(),
      attributes: toOtlpAttributes(sanitizeAttributes(attributes)),
      events: [],
    };
    this.activeSpans.set(spanId, spanRecord);

    return {
      id: spanId,
      end: (status: TelemetryStatus) => {
        this.endSpan(spanId, status);
      },
      recordException: (error: unknown, exceptionAttributes?: TelemetryAttributes) => {
        this.emitException(error, spanId, exceptionAttributes);
      },
    };
  }

  emitDecisionEvent(name: TelemetryDecisionEventName, spanId?: string, attributes?: TelemetryAttributes): void {
    const spanRecord = spanId ? this.activeSpans.get(spanId) : undefined;
    if (!spanRecord) {
      return;
    }

    const schema = TELEMETRY_DECISION_EVENT_SCHEMA[name];
    spanRecord.events.push({
      timeUnixNano: currentTimeUnixNano(),
      name,
      attributes: toOtlpAttributes(sanitizeAttributes(attributes, schema.allowedAttributes)),
    });
  }

  emitException(error: unknown, spanId?: string, attributes?: TelemetryAttributes): void {
    const spanRecord = spanId ? this.activeSpans.get(spanId) : undefined;
    if (!spanRecord) {
      return;
    }

    const normalized = normalizeError(error);
    spanRecord.events.push({
      timeUnixNano: currentTimeUnixNano(),
      name: 'exception',
      attributes: [
        ...toOtlpAttributes({
          'exception.type': String(normalized.name ?? 'UnknownError'),
          'exception.message': String(normalized.message ?? ''),
        }),
        ...toOtlpAttributes(sanitizeAttributes(attributes)),
      ],
    });
  }

  async flush(): Promise<void> {
    await Promise.allSettled([...this.pendingExports]);
  }

  private endSpan(spanId: string, status: TelemetryStatus): void {
    const spanRecord = this.activeSpans.get(spanId);
    if (!spanRecord) {
      return;
    }
    this.activeSpans.delete(spanId);

    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: toOtlpAttributes({
              'service.name': 'ztd-cli',
              'telemetry.export.mode': 'otlp',
            }),
          },
          scopeSpans: [
            {
              scope: {
                name: '@rawsql-ts/ztd-cli',
              },
              spans: [
                {
                  traceId: spanRecord.traceId,
                  spanId: spanRecord.spanId,
                  parentSpanId: spanRecord.parentSpanId,
                  name: spanRecord.name,
                  kind: 1,
                  startTimeUnixNano: spanRecord.startTimeUnixNano,
                  endTimeUnixNano: currentTimeUnixNano(),
                  attributes: spanRecord.attributes,
                  events: spanRecord.events,
                  status: {
                    code: status === 'ok' ? OTLP_STATUS_OK : OTLP_STATUS_ERROR,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const exportPromise = fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        this.pendingExports.delete(exportPromise);
      });

    this.pendingExports.add(exportPromise);
  }
}

const NOOP_SINK = new NoopTelemetrySink();

let telemetrySink: TelemetrySink = NOOP_SINK;
let telemetryEnabled = false;
let telemetryExportMode: TelemetryExportMode = 'console';
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

export function resolveTelemetryExportMode(explicit?: TelemetryExportMode | string | undefined): TelemetryExportMode {
  return normalizeTelemetryExportMode(explicit ?? process.env[TELEMETRY_EXPORT_ENV]);
}

export function resolveTelemetryFilePath(explicit?: string | undefined): string {
  return explicit ?? process.env[TELEMETRY_FILE_ENV] ?? DEFAULT_FILE_EXPORT_PATH;
}

export function resolveTelemetryOtlpEndpoint(explicit?: string | undefined): string {
  return explicit ?? process.env[TELEMETRY_OTLP_ENDPOINT_ENV] ?? DEFAULT_OTLP_HTTP_ENDPOINT;
}

export function setTelemetryEnabled(enabled: boolean): void {
  process.env[TELEMETRY_ENABLED_ENV] = enabled ? '1' : '0';
}

export function configureTelemetry(options: {
  enabled?: boolean | string;
  exportMode?: TelemetryExportMode | string;
  filePath?: string;
  otlpEndpoint?: string;
} = {}): void {
  telemetryEnabled = resolveTelemetryEnabled(options.enabled);
  telemetryExportMode = resolveTelemetryExportMode(options.exportMode);

  if (!telemetryEnabled) {
    telemetrySink = NOOP_SINK;
    spanStack.length = 0;
    return;
  }

  telemetrySink = createTelemetrySink({
    exportMode: telemetryExportMode,
    filePath: resolveTelemetryFilePath(options.filePath),
    otlpEndpoint: resolveTelemetryOtlpEndpoint(options.otlpEndpoint),
  });
  spanStack.length = 0;
}

export function isTelemetryEnabled(): boolean {
  return telemetryEnabled;
}

export function getTelemetryExportMode(): TelemetryExportMode {
  return telemetryExportMode;
}

export async function flushTelemetry(): Promise<void> {
  await telemetrySink.flush();
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

function createTelemetrySink(options: {
  exportMode: TelemetryExportMode;
  filePath: string;
  otlpEndpoint: string;
}): TelemetrySink {
  switch (options.exportMode) {
    case 'console':
      return new JsonLinesTelemetrySink((line) => {
        process.stderr.write(`${line}\n`);
      });
    case 'debug':
      return new DebugTelemetrySink();
    case 'file': {
      const absoluteFile = resolvePath(process.cwd(), options.filePath);
      mkdirSync(dirname(absoluteFile), { recursive: true });
      return new JsonLinesTelemetrySink((line) => {
        appendFileSync(absoluteFile, `${line}\n`, 'utf8');
      });
    }
    case 'otlp':
      return new OtlpHttpTelemetrySink(options.otlpEndpoint);
    default:
      return NOOP_SINK;
  }
}

function buildTelemetryEnvelope(payload: Record<string, unknown>): TelemetryEnvelope {
  return {
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    type: 'telemetry',
    timestamp: new Date().toISOString(),
    ...payload,
  };
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

function normalizeTelemetryExportMode(value: string | undefined): TelemetryExportMode {
  switch ((value ?? 'console').trim().toLowerCase()) {
    case 'console':
    case 'debug':
    case 'file':
    case 'otlp':
      return (value ?? 'console').trim().toLowerCase() as TelemetryExportMode;
    default:
      return 'console';
  }
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

function toOtlpAttributes(attributes: Record<string, TelemetryAttributeValue>): Array<Record<string, unknown>> {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value: toOtlpAnyValue(value),
  }));
}

function toOtlpAnyValue(value: TelemetryAttributeValue): Record<string, unknown> {
  if (value === null) {
    return { stringValue: 'null' };
  }
  if (typeof value === 'boolean') {
    return { boolValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { intValue: value } : { doubleValue: value };
  }
  return { stringValue: value };
}

function currentTimeUnixNano(): string {
  return (BigInt(Date.now()) * BigInt(1000000)).toString();
}

function roundDuration(value: number): number {
  return Math.round(value * 1000) / 1000;
}
