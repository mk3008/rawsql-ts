import path from 'node:path';
import { runInitCommand, type Prompter } from '../../packages/ztd-cli/src/commands/init';

class FixedPrompter implements Prompter {
  private readonly choices: number[] = [1, 0];
  private index = 0;

  async selectChoice(_question: string, _choices: string[]): Promise<number> {
    const selected = this.choices[this.index] ?? 0;
    this.index += 1;
    return selected;
  }

  async promptInput(_question: string, _example?: string): Promise<string> {
    throw new Error('promptInput is not expected in empty scaffold init flow');
  }

  async promptInputWithDefault(
    _question: string,
    defaultValue: string,
    _example?: string
  ): Promise<string> {
    return defaultValue;
  }

  async confirm(_question: string): Promise<boolean> {
    return true;
  }

  close(): void {
    // No-op for fixed prompter.
  }
}

async function main(): Promise<void> {
  const workspaceArg = process.argv[2];
  if (!workspaceArg) {
    throw new Error('workspace path argument is required');
  }

  const workspacePath = path.resolve(workspaceArg);
  const prompter = new FixedPrompter();
  try {
    const result = await runInitCommand(prompter, {
      rootDir: workspacePath,
      forceOverwrite: true,
      nonInteractive: true
    });
    console.log(result.summary);
  } finally {
    prompter.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
