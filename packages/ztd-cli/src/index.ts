#!/usr/bin/env node

import { Command } from 'commander';
import { registerDdlCommands } from './commands/ddl';
import { registerInitCommand } from './commands/init';
import { registerLintCommand } from './commands/lint';
import { registerZtdConfigCommand } from './commands/ztdConfigCommand';

async function main(): Promise<void> {
  const program = new Command();
  program.name('ztd').description('Zero Table Dependency scaffolding and DDL helpers');

  registerInitCommand(program);
  registerLintCommand(program);
  registerZtdConfigCommand(program);
  registerDdlCommands(program);

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
