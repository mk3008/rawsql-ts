#!/usr/bin/env node

import { Command } from 'commander';
import { registerDdlCommands } from './commands/ddl';
import { registerInitCommand } from './commands/init';
import { registerLintCommand } from './commands/lint';
import { registerModelGenCommand } from './commands/modelGen';
import { registerZtdConfigCommand } from './commands/ztdConfigCommand';
import { CheckContractRuntimeError, registerCheckContractCommand } from './commands/checkContract';
import { TestEvidenceRuntimeError, registerTestEvidenceCommand } from './commands/testEvidence';

async function main(): Promise<void> {
  const program = new Command();
  program.name('ztd').description('Zero Table Dependency scaffolding and DDL helpers');

  registerInitCommand(program);
  registerLintCommand(program);
  registerModelGenCommand(program);
  registerCheckContractCommand(program);
  registerTestEvidenceCommand(program);
  registerZtdConfigCommand(program);
  registerDdlCommands(program);

  program.addHelpText('after', `
Getting started:
  $ ztd init                   Create a new ZTD project (interactive)
  $ ztd init --yes             Create a new ZTD project (non-interactive, demo + Zod defaults)
  $ ztd ztd-config             Generate TestRowMap types from DDL
  $ ztd lint <path>            Lint SQL files against the schema

Common workflow:
  1. ztd init                  Scaffold the project
  2. ztd ztd-config            Generate test types from DDL
  3. vitest run                Run tests

After schema changes:
  1. Edit ztd/ddl/*.sql (or run ztd ddl pull)
  2. ztd ztd-config            Regenerate types
  3. vitest run                Verify tests still pass

Documentation: https://github.com/mk3008/rawsql-ts`);

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof CheckContractRuntimeError || error instanceof TestEvidenceRuntimeError) {
    process.exit(2);
  }
  process.exit(1);
});
