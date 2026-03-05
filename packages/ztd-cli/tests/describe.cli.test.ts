import { Command } from 'commander';
import { afterEach, expect, test, vi } from 'vitest';
import { registerDescribeCommand } from '../src/commands/describe';
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
