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
    emitDecisionEvent('generation.started', { dryRun: true });
    throw new Error('boom');
  })).rejects.toThrow('boom');
  recordException(new Error('root failure'), { scope: 'command-root' });
  finishCommandSpan('error');

  const payloads = lines.filter(Boolean).map((line) => JSON.parse(line));
  expect(payloads).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'telemetry', kind: 'span-start', spanName: 'ztd-config' }),
      expect.objectContaining({ type: 'telemetry', kind: 'span-start', spanName: 'generate' }),
      expect.objectContaining({ type: 'telemetry', kind: 'decision', eventName: 'generation.started' }),
      expect.objectContaining({ type: 'telemetry', kind: 'exception', spanId: expect.any(String) }),
      expect.objectContaining({ type: 'telemetry', kind: 'span-end', spanName: 'ztd-config', status: 'error' }),
    ]),
  );
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
