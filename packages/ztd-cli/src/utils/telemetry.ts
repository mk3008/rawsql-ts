import { performance } from 'node:perf_hooks';

export type TelemetryAttributeValue = string | number | boolean | null;
export type TelemetryAttributes = Record<string, TelemetryAttributeValue | undefined>;
export type TelemetryStatus = 'ok' | 'error';

const TELEMETRY_ENABLED_ENV = 'ZTD_CLI_TELEMETRY';
const DEFAULT_SCHEMA_VERSION = 1;

interface TelemetrySpan {
  id: string;
  end(status: TelemetryStatus): void;
  recordException(error: unknown, attributes?: TelemetryAttributes): void;
}

interface TelemetrySink {
  startSpan(name: string, parentSpanId?: string, attributes?: TelemetryAttributes): TelemetrySpan;
  emitDecisionEvent(name: string, spanId?: string, attributes?: TelemetryAttributes): void;
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

  emitDecisionEvent(name: string, spanId?: string, attributes?: TelemetryAttributes): void {
    this.write({
      kind: 'decision',
      eventName: name,
      spanId,
      attributes: sanitizeAttributes(attributes),
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

export function emitDecisionEvent(name: string, attributes: TelemetryAttributes = {}): void {
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

function sanitizeAttributes(attributes: TelemetryAttributes = {}): Record<string, TelemetryAttributeValue> {
  const sanitized: Record<string, TelemetryAttributeValue> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

function roundDuration(value: number): number {
  return Math.round(value * 1000) / 1000;
}
