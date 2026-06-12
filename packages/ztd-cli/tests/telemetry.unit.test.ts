import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import {
  beginCommandSpan,
  configureTelemetry,
  emitDecisionEvent,
  finishCommandSpan,
  flushTelemetry,
  getTelemetryExportMode,
  recordException,
  resolveTelemetryExportMode,
  setTelemetryEnabled,
  withSpan,
  withSpanSync,
  resolveTelemetryIncludeBindValues,
} from '../src/utils/telemetry';

const originalTelemetry = process.env.ZTD_CLI_TELEMETRY;
const originalTelemetryExport = process.env.ZTD_CLI_TELEMETRY_EXPORT;
const originalTelemetryFile = process.env.ZTD_CLI_TELEMETRY_FILE;
const originalTelemetryEndpoint = process.env.ZTD_CLI_TELEMETRY_OTLP_ENDPOINT;
const originalTelemetryIncludeBindValues = process.env.ZTD_CLI_TELEMETRY_INCLUDE_BIND_VALUES;

function createWorkspace(prefix: string): string {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  mkdirSync(tmpRoot, { recursive: true });
  return mkdtempSync(path.join(tmpRoot, prefix + '-'));
}

afterEach(async () => {
  if (originalTelemetry === undefined) {
    delete process.env.ZTD_CLI_TELEMETRY;
  } else {
    process.env.ZTD_CLI_TELEMETRY = originalTelemetry;
  }

  if (originalTelemetryExport === undefined) {
    delete process.env.ZTD_CLI_TELEMETRY_EXPORT;
  } else {
    process.env.ZTD_CLI_TELEMETRY_EXPORT = originalTelemetryExport;
  }

  if (originalTelemetryFile === undefined) {
    delete process.env.ZTD_CLI_TELEMETRY_FILE;
  } else {
    process.env.ZTD_CLI_TELEMETRY_FILE = originalTelemetryFile;
  }

  if (originalTelemetryEndpoint === undefined) {
    delete process.env.ZTD_CLI_TELEMETRY_OTLP_ENDPOINT;
  } else {
    process.env.ZTD_CLI_TELEMETRY_OTLP_ENDPOINT = originalTelemetryEndpoint;
  }

  if (originalTelemetryIncludeBindValues === undefined) {
    delete process.env.ZTD_CLI_TELEMETRY_INCLUDE_BIND_VALUES;
  } else {
    process.env.ZTD_CLI_TELEMETRY_INCLUDE_BIND_VALUES = originalTelemetryIncludeBindValues;
  }

  configureTelemetry({ enabled: false });
  await flushTelemetry();
  vi.restoreAllMocks();
});

test('telemetry is a no-op by default', async () => {
  const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    void chunk;
    return true;
  }) as typeof process.stderr.write);

  configureTelemetry({ enabled: false });
  beginCommandSpan('ztd-config');
  emitDecisionEvent('command.selected', { command: 'ztd-config' });
  await withSpan('phase', async () => undefined);
  recordException(new Error('ignored'));
  finishCommandSpan('ok');
  await flushTelemetry();

  expect(writeSpy).not.toHaveBeenCalled();
});

test('telemetry defaults to console export when enabled without an explicit export mode', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  setTelemetryEnabled(true);
  configureTelemetry();
  expect(getTelemetryExportMode()).toBe('console');

  beginCommandSpan('ztd-config', { outputFormat: 'json' });
  emitDecisionEvent('command.selected', { command: 'ztd-config' });
  await expect(withSpan('generate', async () => {
    emitDecisionEvent('output.json-envelope');
    throw new Error('boom');
  })).rejects.toThrow('boom');
  recordException(new Error('root failure'), { scope: 'command-root' });
  finishCommandSpan('error');
  await flushTelemetry();

  const payloads = lines.filter(Boolean).map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'telemetry', kind: 'span-start', spanName: 'ztd-config' }),
      expect.objectContaining({ type: 'telemetry', kind: 'span-start', spanName: 'generate' }),
      expect.objectContaining({ type: 'telemetry', kind: 'decision', eventName: 'output.json-envelope' }),
      expect.objectContaining({ type: 'telemetry', kind: 'exception', spanId: expect.any(String) }),
      expect.objectContaining({ type: 'telemetry', kind: 'span-end', spanName: 'ztd-config', status: 'error' }),
    ]),
  );
});

test('debug export emits human-readable telemetry lines for local inspection', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);

  configureTelemetry({ enabled: true, exportMode: 'debug' });
  beginCommandSpan('query uses table');
  emitDecisionEvent('command.selected', { command: 'query uses table' });
  finishCommandSpan('ok');
  await flushTelemetry();

  const serialized = lines.join('');
  expect(serialized).toContain('[telemetry] span-start query uses table');
  expect(serialized).toContain('[telemetry] decision command.selected');
  expect(serialized).toContain('[telemetry] span-end query uses table');
  expect(() => JSON.parse(serialized)).toThrow();
});

test('file export writes JSONL telemetry that CI can archive', async () => {
  const workspace = createWorkspace('telemetry-file');
  const filePath = path.join(workspace, 'artifacts', 'telemetry.jsonl');

  configureTelemetry({ enabled: true, exportMode: 'file', filePath });
  beginCommandSpan('ddl diff');
  await withSpan('collect-local-ddl', async () => undefined, { localFileCount: 2 });
  finishCommandSpan('ok');
  await flushTelemetry();

  expect(existsSync(filePath)).toBe(true);
  const payloads = readFileSync(filePath, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'span-start', spanName: 'ddl diff' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'collect-local-ddl' }),
      expect.objectContaining({ kind: 'span-end', spanName: 'ddl diff', status: 'ok' }),
    ]),
  );
});

test('otlp export posts completed spans to an OTLP HTTP endpoint', async () => {
  const fetchSpy = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal('fetch', fetchSpy);

  configureTelemetry({ enabled: true, exportMode: 'otlp', otlpEndpoint: 'http://127.0.0.1:4318/v1/traces' });
  beginCommandSpan('model-gen');
  emitDecisionEvent('model-gen.probe-mode', { probeMode: 'live' });
  await withSpan('probe-client-connect', async () => undefined, { probeMode: 'live' });
  finishCommandSpan('ok');
  await flushTelemetry();

  expect(fetchSpy).toHaveBeenCalled();
  const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://127.0.0.1:4318/v1/traces');
  const body = JSON.parse(String(init.body));
  expect(body.resourceSpans[0].scopeSpans[0].spans[0]).toEqual(
    expect.objectContaining({
      name: 'probe-client-connect',
      traceId: expect.any(String),
      spanId: expect.any(String),
      parentSpanId: expect.any(String),
    }),
  );
  expect(body.resourceSpans[0].scopeSpans[0].spans[0].events).toEqual([]);
});

test('SQL text is visible by default, credentials and bind values are redacted', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  const dsn = 'postgres://demo:secret@localhost:5432/app';
  const libpqDsn = 'host=localhost port=5432 dbname=app user=demo password=secret';
  const sql = 'SELECT email FROM public.users WHERE id = $1';
  const filesystemDump = Array.from({ length: 20 }, (_, index) => `C:/tmp/file-${index}.sql`).join('\n');

  setTelemetryEnabled(true);
  configureTelemetry();
  beginCommandSpan('model-gen', {
    connectionUrl: dsn,
    scope: 'command-root',
  });
  emitDecisionEvent('model-gen.probe-mode', {
    probeMode: 'live',
    sqlText: sql,
    connectionUrl: dsn,
  });
  await withSpan('probe-client-connect', async () => undefined, {
    databaseUrl: dsn,
    sqlText: sql,
    outFile: 'src/catalog/specs/generated/getSales.generated.ts',
  });
  recordException(new Error(`Probe failed for ${libpqDsn}`), {
    bindValues: '[1,"secret"]',
    filesystemDump,
  });
  finishCommandSpan('error');
  await flushTelemetry();

  const serialized = lines.join('\n');
  // DSN and credentials are always redacted
  expect(serialized).not.toContain(dsn);
  expect(serialized).not.toContain(libpqDsn);
  expect(serialized).not.toContain('secret');
  expect(serialized).not.toContain(filesystemDump);
  // SQL text is now visible
  expect(serialized).toContain(sql);

  const payloads = lines.filter(Boolean).map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'decision',
        eventName: 'model-gen.probe-mode',
        attributes: { probeMode: 'live' },
      }),
      expect.objectContaining({
        kind: 'span-start',
        spanName: 'probe-client-connect',
        attributes: {
          databaseUrl: '[REDACTED]',
          sqlText: sql,
          outFile: 'src/catalog/specs/generated/getSales.generated.ts',
        },
      }),
      expect.objectContaining({
        kind: 'exception',
        error: {
          name: 'Error',
          message: '[REDACTED]',
        },
        attributes: {
          bindValues: '[REDACTED]',
          filesystemDump: '[REDACTED]',
        },
      }),
    ]),
  );
});

test('authorization-style secrets are redacted by key and value detectors', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  const apiKey = 'demoApiKey12345';
  const accessKey = 'demoAccessKey67890';
  const authorization = 'Bearer demo-token-abcdef12';

  setTelemetryEnabled(true);
  configureTelemetry();
  beginCommandSpan('model-gen', {
    apiKey,
    scope: 'command-root',
  });
  await withSpan('probe-client-connect', async () => undefined, {
    authorization,
    accessKey,
    note: authorization,
  });
  recordException(new Error(`authorization=${authorization}`), {
    apiKey,
  });
  finishCommandSpan('error');
  await flushTelemetry();

  const serialized = lines.join('\n');
  expect(serialized).not.toContain(apiKey);
  expect(serialized).not.toContain(accessKey);
  expect(serialized).not.toContain(authorization);

  const payloads = lines.filter(Boolean).map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'span-start',
        spanName: 'model-gen',
        attributes: {
          apiKey: '[REDACTED]',
          scope: 'command-root',
        },
      }),
      expect.objectContaining({
        kind: 'span-start',
        spanName: 'probe-client-connect',
        attributes: {
          authorization: '[REDACTED]',
          accessKey: '[REDACTED]',
          note: '[REDACTED]',
        },
      }),
      expect.objectContaining({
        kind: 'exception',
        error: {
          name: 'Error',
          message: '[REDACTED]',
        },
        attributes: {
          apiKey: '[REDACTED]',
        },
      }),
    ]),
  );
});

test('benign oversized and multiline attributes use truncation without redaction', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  const multilineNote = ['phase summary', 'line two', 'line three'].join('\n');
  const longNote = 'safe-output-'.repeat(20);

  setTelemetryEnabled(true);
  configureTelemetry();
  beginCommandSpan('query uses table');
  await withSpan('render-query-usage-output', async () => 'ok', {
    summary: multilineNote,
    preview: longNote,
  });
  finishCommandSpan('ok');
  await flushTelemetry();

  const payloads = lines.filter(Boolean).map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'span-start',
        spanName: 'render-query-usage-output',
        attributes: {
          summary: `[TRUNCATED:${multilineNote.length}]`,
          preview: `[TRUNCATED:${longNote.length}]`,
        },
      }),
    ]),
  );

  const serialized = lines.join('\n');
  expect(serialized).not.toContain(multilineNote);
  expect(serialized).not.toContain(longNote);
  expect(serialized).not.toContain('[REDACTED]');
});

test('withSpanSync emits synchronous child span lifecycle when enabled', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  setTelemetryEnabled(true);
  configureTelemetry();
  beginCommandSpan('ddl diff');
  const value = withSpanSync('compute-diff-plan', () => 'ok', { localFileCount: 2 });
  finishCommandSpan('ok');
  await flushTelemetry();

  expect(value).toBe('ok');
  const payloads = lines.filter(Boolean).map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'span-start', spanName: 'compute-diff-plan', attributes: { localFileCount: 2 } }),
      expect.objectContaining({ kind: 'span-end', spanName: 'compute-diff-plan', status: 'ok' }),
    ]),
  );
});

test('telemetry export mode falls back to env configuration', () => {
  process.env.ZTD_CLI_TELEMETRY_EXPORT = 'debug';
  expect(resolveTelemetryExportMode(undefined)).toBe('debug');
});

test('bind values are visible when includeBindValues is enabled', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  const bindJson = '[1,"test@example.com"]';

  configureTelemetry({ enabled: true, includeBindValues: true });
  beginCommandSpan('query plan');
  await withSpan('execute-query', async () => undefined, {
    sqlText: 'SELECT * FROM users WHERE id = $1',
    bindValues: bindJson,
    paramValue: 'hello',
  });
  finishCommandSpan('ok');
  await flushTelemetry();

  const payloads = lines.filter(Boolean).map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'span-start',
        spanName: 'execute-query',
        attributes: {
          sqlText: 'SELECT * FROM users WHERE id = $1',
          bindValues: bindJson,
          paramValue: 'hello',
        },
      }),
    ]),
  );
});

test('bind values are redacted by default even when SQL text is visible', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  configureTelemetry({ enabled: true, includeBindValues: false });
  beginCommandSpan('query plan');
  await withSpan('execute-query', async () => undefined, {
    sqlText: 'SELECT * FROM users WHERE id = $1',
    bindValues: '[42]',
  });
  finishCommandSpan('ok');
  await flushTelemetry();

  const payloads = lines.filter(Boolean).map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'span-start',
        spanName: 'execute-query',
        attributes: {
          sqlText: 'SELECT * FROM users WHERE id = $1',
          bindValues: '[REDACTED]',
        },
      }),
    ]),
  );
});

test('SQL text attributes are not truncated even when long or multiline', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  const longSql = 'SELECT ' + Array.from({ length: 50 }, (_, i) => `col_${i}`).join(', ') + ' FROM public.wide_table WHERE id = $1';
  const multilineSql = 'SELECT\n  id,\n  name,\n  email\nFROM public.users\nWHERE active = $1';

  configureTelemetry({ enabled: true });
  beginCommandSpan('query plan');
  await withSpan('long-query', async () => undefined, { sqlText: longSql });
  await withSpan('multiline-query', async () => undefined, { queryText: multilineSql });
  finishCommandSpan('ok');
  await flushTelemetry();

  const payloads = lines.filter(Boolean).map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'span-start',
        spanName: 'long-query',
        attributes: { sqlText: longSql },
      }),
      expect.objectContaining({
        kind: 'span-start',
        spanName: 'multiline-query',
        attributes: { queryText: multilineSql },
      }),
    ]),
  );
});

test('credentials are always redacted even when includeBindValues is enabled', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  const dsn = 'postgres://demo:secret@localhost:5432/app';

  configureTelemetry({ enabled: true, includeBindValues: true });
  beginCommandSpan('model-gen', {
    connectionUrl: dsn,
    password: 'hunter2',
  });
  finishCommandSpan('ok');
  await flushTelemetry();

  const serialized = lines.join('\n');
  expect(serialized).not.toContain(dsn);
  expect(serialized).not.toContain('hunter2');
  expect(serialized).toContain('[REDACTED]');
});

test('includeBindValues falls back to env configuration', () => {
  process.env.ZTD_CLI_TELEMETRY_INCLUDE_BIND_VALUES = '1';
  expect(resolveTelemetryIncludeBindValues(undefined)).toBe(true);

  process.env.ZTD_CLI_TELEMETRY_INCLUDE_BIND_VALUES = '0';
  expect(resolveTelemetryIncludeBindValues(undefined)).toBe(false);
});
