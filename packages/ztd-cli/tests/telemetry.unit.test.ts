import { afterEach, expect, test, vi } from 'vitest';
import {
  beginCommandSpan,
  configureTelemetry,
  emitDecisionEvent,
  finishCommandSpan,
  recordException,
  setTelemetryEnabled,
  withSpan,
  withSpanSync,
} from '../src/utils/telemetry';

const originalTelemetry = process.env.ZTD_CLI_TELEMETRY;

afterEach(() => {
  if (originalTelemetry === undefined) {
    delete process.env.ZTD_CLI_TELEMETRY;
  } else {
    process.env.ZTD_CLI_TELEMETRY = originalTelemetry;
  }
  configureTelemetry({ enabled: false });
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

  expect(writeSpy).not.toHaveBeenCalled();
});

test('telemetry emits root spans, child spans, decision events, and exceptions when enabled', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  setTelemetryEnabled(true);
  configureTelemetry();
  beginCommandSpan('ztd-config', { outputFormat: 'json' });
  emitDecisionEvent('command.selected', { command: 'ztd-config' });
  await expect(withSpan('generate', async () => {
    emitDecisionEvent('output.json-envelope');
    throw new Error('boom');
  })).rejects.toThrow('boom');
  recordException(new Error('root failure'), { scope: 'command-root' });
  finishCommandSpan('error');

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

test('decision events keep only schema-approved attributes and redact sensitive payloads', async () => {
  const lines: string[] = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    lines.push(String(chunk).trim());
    return true;
  }) as typeof process.stderr.write);

  const dsn = 'postgres://demo:secret@localhost:5432/app';
  const libpqDsn = 'host=localhost port=5432 dbname=app user=demo password=secret';
  const sql = 'SELECT email FROM public.users WHERE password = :password';
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
  recordException(new Error(`Probe failed for ${libpqDsn} while running ${sql}`), {
    bindValues: '[1,"secret"]',
    filesystemDump,
  });
  finishCommandSpan('error');

  const serialized = lines.join('\n');
  expect(serialized).not.toContain(dsn);
  expect(serialized).not.toContain(libpqDsn);
  expect(serialized).not.toContain(sql);
  expect(serialized).not.toContain('secret');
  expect(serialized).not.toContain(filesystemDump);

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
          sqlText: '[REDACTED]',
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

test('withSpanSync emits synchronous child span lifecycle when enabled', () => {
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

  expect(value).toBe('ok');
  const payloads = lines.filter(Boolean).map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'span-start', spanName: 'compute-diff-plan', attributes: { localFileCount: 2 } }),
      expect.objectContaining({ kind: 'span-end', spanName: 'compute-diff-plan', status: 'ok' }),
    ]),
  );
});
