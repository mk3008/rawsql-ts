import { Command } from 'commander';
import { afterEach, expect, test, vi } from 'vitest';
import { getDescribeCommandDescriptors, registerDescribeCommand } from '../src/commands/describe';
import { setAgentOutputFormat } from '../src/utils/agentCli';

const originalFormat = process.env.ZTD_CLI_OUTPUT_FORMAT;

afterEach(() => {
  process.env.ZTD_CLI_OUTPUT_FORMAT = originalFormat;
});

function createProgram(capture: { stdout: string[]; stderr: string[] }): Command {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => capture.stdout.push(str),
    writeErr: (str) => capture.stderr.push(str)
  });
  registerDescribeCommand(program);
  return program;
}

test('describe command emits JSON envelope when global output is json', async () => {
  setAgentOutputFormat('json');
  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createProgram(capture);
  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    capture.stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);

  await program.parseAsync(['describe', 'command', 'model-gen'], { from: 'user' });
  writeSpy.mockRestore();

  const parsed = JSON.parse(capture.stdout.join(''));
  expect(parsed).toMatchSnapshot();
  expect(capture.stderr).toEqual([]);
});

test('describe metadata documents RFBA scope discovery options for contract and evidence commands', () => {
  const descriptors = getDescribeCommandDescriptors();
  const checkContract = descriptors.find((descriptor) => descriptor.name === 'check contract');
  const evidence = descriptors.find((descriptor) => descriptor.name === 'evidence');

  expect(checkContract?.flags).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: '--scope-dir' }),
    expect.objectContaining({ name: '--specs-dir', description: expect.stringContaining('Legacy') })
  ]));
  expect(checkContract?.summary).toContain('QuerySpec-backed');
  expect(evidence?.flags).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: '--scope-dir' }),
    expect.objectContaining({ name: '--specs-dir', description: expect.stringContaining('Legacy') })
  ]));
  expect(evidence?.summary).toContain('project QuerySpec');
});

test('describe command snapshots the top-level command catalog and every detailed descriptor', async () => {
  setAgentOutputFormat('json');
  const rootCapture = { stdout: [] as string[], stderr: [] as string[] };
  const rootProgram = createProgram(rootCapture);
  const rootWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    rootCapture.stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);

  await rootProgram.parseAsync(['describe'], { from: 'user' });
  rootWriteSpy.mockRestore();

  expect(JSON.parse(rootCapture.stdout.join(''))).toMatchSnapshot('describe-root');

  for (const descriptor of getDescribeCommandDescriptors()) {
    const capture = { stdout: [] as string[], stderr: [] as string[] };
    const program = createProgram(capture);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      capture.stdout.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);

    await program.parseAsync(['describe', 'command', descriptor.name], { from: 'user' });
    writeSpy.mockRestore();

    expect(JSON.parse(capture.stdout.join(''))).toMatchSnapshot(descriptor.name);
    expect(capture.stderr).toEqual([]);
  }
});
