import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { buildProgram } from '../src/index';
import { configureTelemetry } from '../src/utils/telemetry';

const originalOutput = process.env.ZTD_CLI_OUTPUT_FORMAT;
const originalTelemetry = process.env.ZTD_CLI_TELEMETRY;

function createWorkspace(prefix: string): string {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  mkdirSync(tmpRoot, { recursive: true });
  const root = mkdtempSync(path.join(tmpRoot, `${prefix}-`));
  mkdirSync(path.join(root, 'ztd', 'ddl'), { recursive: true });
  return root;
}

afterEach(() => {
  if (originalOutput === undefined) {
    delete process.env.ZTD_CLI_OUTPUT_FORMAT;
  } else {
    process.env.ZTD_CLI_OUTPUT_FORMAT = originalOutput;
  }
  if (originalTelemetry === undefined) {
    delete process.env.ZTD_CLI_TELEMETRY;
  } else {
    process.env.ZTD_CLI_TELEMETRY = originalTelemetry;
  }
  configureTelemetry({ enabled: false });
  vi.restoreAllMocks();
});

test('real CLI root wiring emits telemetry events for ztd-config when --telemetry is enabled', async () => {
  const workspace = createWorkspace('ztd-config-telemetry');
  const ddlDir = path.join(workspace, 'ztd', 'ddl');
  const ddlFile = path.join(ddlDir, 'public.sql');
  const outputFile = path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts');
  const relativeDdlDir = path.relative(process.cwd(), ddlDir);
  const relativeOutputFile = path.relative(process.cwd(), outputFile);

  writeFileSync(
    ddlFile,
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY,
        email text NOT NULL
      );
    `,
    'utf8',
  );

  const stdout: string[] = [];
  const stderrLines: string[] = [];
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stderrLines.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);

  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(
    ['node', 'ztd', '--telemetry', '--output', 'json', 'ztd-config', '--ddl-dir', relativeDdlDir, '--out', relativeOutputFile, '--dry-run'],
    { from: 'node' },
  );

  stderrSpy.mockRestore();
  stdoutSpy.mockRestore();

  const envelope = JSON.parse(stdout.join(''));
  expect(envelope).toMatchObject({
    command: 'ztd-config',
    ok: true,
    data: {
      dryRun: true,
    },
  });

  const telemetryEvents = stderrLines
    .join('')
    .split(/\r?\n/)
    .filter((line) => line.includes('"type":"telemetry"'))
    .map((line) => JSON.parse(line));

  expect(telemetryEvents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'span-start', spanName: 'ztd-config' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'resolve-command-state' }),
      expect.objectContaining({ kind: 'span-start', spanName: 'generate-ztd-config' }),
      expect.objectContaining({ kind: 'decision', eventName: 'output.json-envelope' }),
      expect.objectContaining({ kind: 'span-end', spanName: 'ztd-config', status: 'ok' }),
    ]),
  );
});

test('ztd-config does not emit a config.updated decision when the effective config is unchanged', async () => {
  const workspace = createWorkspace('ztd-config-noop-update');
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(workspace);
  const ddlDir = path.join(workspace, 'ztd', 'ddl');
  const ddlFile = path.join(ddlDir, 'public.sql');

  writeFileSync(
    ddlFile,
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY,
        email text NOT NULL
      );
    `,
    'utf8',
  );
  writeFileSync(
    path.join(workspace, 'ztd.config.json'),
    JSON.stringify(
      {
        dialect: 'postgres',
        ddlDir: 'ztd/ddl',
        testsDir: 'tests',
        ddl: { defaultSchema: 'public', searchPath: ['public'] },
        ddlLint: 'strict'
      },
      null,
      2,
    ),
    'utf8',
  );
  try {
    const stdout: string[] = [];
    const stderrLines: string[] = [];
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      stderrLines.push(String(chunk));
      return true;
    }) as typeof process.stderr.write);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      stdout.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);

    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      [
        'node',
        'ztd',
        '--telemetry',
        '--output',
        'json',
        'ztd-config',
        '--ddl-dir',
        'ztd/ddl',
        '--out',
        'tests/generated/ztd-row-map.generated.ts',
        '--default-schema',
        'public',
        '--search-path',
        'public'
      ],
      { from: 'node' },
    );

    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();

    const envelope = JSON.parse(stdout.join(''));
    expect(envelope).toMatchObject({
      command: 'ztd-config',
      ok: true,
      data: {
        configUpdated: false
      }
    });

    const telemetryEvents = stderrLines
      .join('')
      .split(/\r?\n/)
      .filter((line) => line.includes('"type":"telemetry"'))
      .map((line) => JSON.parse(line));

    expect(telemetryEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'span-start', spanName: 'persist-project-config' }),
        expect.objectContaining({ kind: 'span-end', spanName: 'persist-project-config', status: 'ok' }),
        expect.objectContaining({ kind: 'decision', eventName: 'output.json-envelope' }),
      ]),
    );
    expect(
      telemetryEvents.some((event) => event.kind === 'decision' && event.eventName === 'config.updated')
    ).toBe(false);
  } finally {
    cwdSpy.mockRestore();
  }
});

test('real CLI root wiring enables telemetry from env when the flag is omitted', async () => {
  const workspace = createWorkspace('ztd-config-telemetry-env');
  const ddlDir = path.join(workspace, 'ztd', 'ddl');
  const ddlFile = path.join(ddlDir, 'public.sql');
  const outputFile = path.join(workspace, 'tests', 'generated', 'ztd-row-map.generated.ts');
  const relativeDdlDir = path.relative(process.cwd(), ddlDir);
  const relativeOutputFile = path.relative(process.cwd(), outputFile);

  writeFileSync(
    ddlFile,
    `
      CREATE TABLE public.accounts (
        id serial PRIMARY KEY,
        email text NOT NULL
      );
    `,
    'utf8',
  );

  process.env.ZTD_CLI_TELEMETRY = '1';

  const stderrLines: string[] = [];
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stderrLines.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    void chunk;
    return true;
  }) as typeof process.stdout.write);

  const program = buildProgram();
  program.exitOverride();
  await program.parseAsync(
    ['node', 'ztd', '--output', 'json', 'ztd-config', '--ddl-dir', relativeDdlDir, '--out', relativeOutputFile, '--dry-run'],
    { from: 'node' },
  );

  stderrSpy.mockRestore();
  stdoutSpy.mockRestore();

  const telemetryEvents = stderrLines
    .join('')
    .split(/\r?\n/)
    .filter((line) => line.includes('"type":"telemetry"'))
    .map((line) => JSON.parse(line));

  expect(telemetryEvents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'span-start', spanName: 'ztd-config' }),
      expect.objectContaining({ kind: 'decision', eventName: 'command.selected' }),
      expect.objectContaining({ kind: 'span-end', spanName: 'ztd-config', status: 'ok' }),
    ]),
  );
});
