import { readFileSync } from 'node:fs';
import path from 'node:path';

export type AgentOutputFormat = 'text' | 'json';
export type DiagnosticSeverity = 'info' | 'warning' | 'error';

const OUTPUT_FORMAT_ENV = 'ZTD_CLI_OUTPUT_FORMAT';
const DEFAULT_SCHEMA_VERSION = 1;

export interface DiagnosticEvent {
  code: string;
  message: string;
  severity?: DiagnosticSeverity;
  details?: Record<string, unknown>;
}

export interface CommandEnvelope<T> {
  schemaVersion: 1;
  command: string;
  ok: boolean;
  data: T;
}

export function setAgentOutputFormat(format: string | undefined): void {
  const normalized = normalizeOutputFormat(format);
  process.env[OUTPUT_FORMAT_ENV] = normalized;
}

export function getAgentOutputFormat(): AgentOutputFormat {
  return normalizeOutputFormat(process.env[OUTPUT_FORMAT_ENV]);
}

export function isJsonOutput(): boolean {
  return getAgentOutputFormat() === 'json';
}

export function normalizeOutputFormat(format: string | undefined): AgentOutputFormat {
  const normalized = (format ?? 'text').trim().toLowerCase();
  if (normalized === 'text' || normalized === 'json') {
    return normalized;
  }
  throw new Error(`Unsupported output format: ${format}`);
}

export function emitDiagnostic(event: DiagnosticEvent): void {
  const severity = event.severity ?? 'info';
  if (isJsonOutput()) {
    const payload = {
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      type: 'diagnostic',
      severity,
      code: event.code,
      message: event.message,
      details: event.details ?? {}
    };
    process.stderr.write(`${JSON.stringify(payload)}\n`);
    return;
  }

  const prefix = severity === 'error' ? '[error]' : severity === 'warning' ? '[warn]' : '[info]';
  process.stderr.write(`${prefix} ${event.message}\n`);
}

export function writeCommandEnvelope<T>(command: string, data: T): void {
  writeCommandResultEnvelope(command, true, data);
}

export function writeCommandResultEnvelope<T>(command: string, ok: boolean, data: T): void {
  const payload: CommandEnvelope<T> = {
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    command,
    ok,
    data
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export function parseJsonPayload<T extends Record<string, unknown>>(value: string, label: string): T {
  const raw = value.startsWith('@')
    ? readFileSync(path.resolve(process.cwd(), value.slice(1)), 'utf8')
    : value;
  try {
    const parsed = JSON.parse(raw);
    if (!isPlainRecord(parsed)) {
      throw new Error(`${label} must decode to a JSON object.`);
    }
    return parsed as T;
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
