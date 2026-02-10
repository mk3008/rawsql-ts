import { spawn } from 'node:child_process';

export interface CommandLog {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  outputHead: string;
}

export interface ExecOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  stdinText?: string;
  shell?: boolean;
  timeoutMs?: number;
}

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  log: CommandLog;
}

const OUTPUT_HEAD_LINES = 30;

function buildOutputHead(stdout: string, stderr: string): string {
  const merged = [stdout.trim(), stderr.trim()].filter((part) => part.length > 0).join('\n');
  if (merged.length === 0) {
    return '';
  }
  return merged.split(/\r?\n/).slice(0, OUTPUT_HEAD_LINES).join('\n');
}

export async function runCommand(options: ExecOptions): Promise<ExecResult> {
  return new Promise<ExecResult>((resolve) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.shell ?? false
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error: Error) => {
      stderr += `${error.message}\n`;
    });

    if (options.stdinText !== undefined) {
      child.stdin.write(options.stdinText);
      child.stdin.end();
    }

    child.on('close', (exitCode: number | null) => {
      const log: CommandLog = {
        command: options.command,
        args: options.args,
        cwd: options.cwd,
        exitCode,
        outputHead: buildOutputHead(stdout, stderr)
      };
      resolve({ exitCode, stdout, stderr, log });
    });
  });
}
