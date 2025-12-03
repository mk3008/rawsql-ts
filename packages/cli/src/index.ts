#!/usr/bin/env node

import { Command } from 'commander';
import { registerDdlCommands } from './commands/ddl';

async function main(): Promise<void> {
  const program = new Command();
  program.name('rawsql').description('CLI for rawsql-ts DDL workflows');

  registerDdlCommands(program);

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  // Report errors to the console and ensure the process exits with failure status.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
