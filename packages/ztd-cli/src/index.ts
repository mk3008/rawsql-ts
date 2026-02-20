#!/usr/bin/env node

import { Command } from 'commander';
import { registerDdlCommands } from './commands/ddl';
import { registerInitCommand } from './commands/init';
import { registerLintCommand } from './commands/lint';
import { registerZtdConfigCommand } from './commands/ztdConfigCommand';
import { CheckContractRuntimeError, registerCheckContractCommand } from './commands/checkContract';
import { TestEvidenceRuntimeError, registerTestEvidenceCommand } from './commands/testEvidence';

async function main(): Promise<void> {
  const program = new Command();
  program.name('ztd').description('Zero Table Dependency scaffolding and DDL helpers');

  registerInitCommand(program);
  registerLintCommand(program);
  registerCheckContractCommand(program);
  registerTestEvidenceCommand(program);
  registerZtdConfigCommand(program);
  registerDdlCommands(program);

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof CheckContractRuntimeError || error instanceof TestEvidenceRuntimeError) {
    process.exit(2);
  }
  process.exit(1);
});
