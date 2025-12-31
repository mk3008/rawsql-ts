import { spawn } from 'node:child_process';

export function platformCommand(command: string): string {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

export function quoteArg(arg: string): string {
  if (/[\s"]/u.test(arg)) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return arg;
}

export async function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  options: {
    cwd: string;
  },
): Promise<void> {
  const commandLine = [command, ...args].map(quoteArg).join(' ');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(commandLine, {
      cwd: options.cwd,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const message = [
        `Command failed: ${command} ${args.join(' ')}`,
        stdout.trim(),
        stderr.trim(),
      ]
        .filter((line) => line.length > 0)
        .join('\n');
      reject(new Error(message));
    });
  });
}
