#!/usr/bin/env node
import { buildCommand } from './commands/build.js';
import { exportCommand } from './commands/export.js';

type CommandHandler = (args: string[]) => Promise<void> | void;

const commands: Record<string, CommandHandler> = {
  build: buildCommand,
  export: exportCommand,
};

function printUsage(): void {
  console.log(
    ['Usage: rawsql <command> [options]', '', 'Commands:', '  build [files...]   Expand CTE resources directly into rawsql/root SQL files', '  export             Copy rawsql/root SQL files into /sql'].join('\n'),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args.shift();

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exitCode = command ? 0 : 1;
    return;
  }

  const handler = commands[command];

  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    await handler(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
