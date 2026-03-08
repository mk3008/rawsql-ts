#!/usr/bin/env node

import { Command } from 'commander';
import { registerAgentsCommand } from './commands/agents';
import { CheckContractRuntimeError, registerCheckContractCommand } from './commands/checkContract';
import { registerDescribeCommand } from './commands/describe';
import { registerDdlCommands } from './commands/ddl';
import { registerInitCommand } from './commands/init';
import { registerLintCommand } from './commands/lint';
import { registerModelGenCommand } from './commands/modelGen';
import { registerQueryCommands } from './commands/query';
import { TestEvidenceRuntimeError, registerTestEvidenceCommand } from './commands/testEvidence';
import { registerZtdConfigCommand } from './commands/ztdConfigCommand';
import { setAgentOutputFormat } from './utils/agentCli';
import {
  beginCommandSpan,
  configureTelemetry,
  emitDecisionEvent,
  finishCommandSpan,
  recordException,
} from './utils/telemetry';

function getCommandPath(command: Command): string {
  const segments: string[] = [];
  let current: Command | null = command;

  while (current) {
    const name = current.name();
    if (name && name !== 'ztd') {
      segments.unshift(name);
    }
    current = current.parent ?? null;
  }

  return segments.join(' ');
}

export function buildProgram(): Command {
  const program = new Command();
  program.name('ztd').description('Zero Table Dependency scaffolding and DDL helpers');
  program.option('--output <format>', 'Global output format (text|json)', 'text');
  program.option('--telemetry', 'Enable internal telemetry events on stderr');
  program.hook('preAction', (_rootCommand: Command, actionCommand: Command) => {
    const options = actionCommand.optsWithGlobals() as { output?: string; telemetry?: boolean };
    setAgentOutputFormat(options.output);

    // Preserve env-based opt-in when the CLI flag was not provided explicitly.
    const telemetryOptionSource = actionCommand.getOptionValueSource('telemetry');
    configureTelemetry({
      enabled: telemetryOptionSource === 'default' ? undefined : options.telemetry,
    });

    const commandPath = getCommandPath(actionCommand);
    beginCommandSpan(commandPath, {
      outputFormat: options.output ?? 'text',
      telemetryEnabled: telemetryOptionSource === 'default'
        ? undefined
        : Boolean(options.telemetry),
    });
    emitDecisionEvent('command.selected', { command: commandPath });
  });
  program.hook('postAction', (_rootCommand: Command, actionCommand: Command) => {
    emitDecisionEvent('command.completed', { command: getCommandPath(actionCommand) });
    finishCommandSpan('ok');
  });

  registerInitCommand(program);
  registerAgentsCommand(program);
  registerLintCommand(program);
  registerModelGenCommand(program);
  registerQueryCommands(program);
  registerCheckContractCommand(program);
  registerTestEvidenceCommand(program);
  registerZtdConfigCommand(program);
  registerDdlCommands(program);
  registerDescribeCommand(program);

  program.addHelpText('after', `
Getting started:
  $ ztd init                   Create a new ZTD project (interactive)
  $ ztd init --yes             Create a new ZTD project (non-interactive, demo + Zod defaults)
  $ ztd agents install         Materialize visible AGENTS.md files on demand
  $ ztd ztd-config             Generate TestRowMap types from DDL
  $ ztd lint <path>            Lint SQL files against the schema
  $ ztd query uses table public.users
  $ ztd query uses column public.users.email --format json

Common workflow:
  1. ztd init                  Scaffold the project
  2. ztd ztd-config            Generate test types from DDL
  3. vitest run                Run tests

After schema changes:
  1. Edit ztd/ddl/*.sql (or run ztd ddl pull)
  2. ztd ztd-config            Regenerate types
  3. vitest run                Verify tests still pass

Documentation: https://github.com/mk3008/rawsql-ts`);

  return program;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}

function handleFatalError(error: unknown): never {
  // Keep a terminal root exception alongside child span failures so exporters can correlate
  // the failing phase with the overall command outcome without inferring it from child spans.
  recordException(error, { scope: 'command-root' });
  finishCommandSpan('error');
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof CheckContractRuntimeError || error instanceof TestEvidenceRuntimeError) {
    process.exit(2);
  }
  process.exit(1);
}

if (require.main === module) {
  void main().catch(handleFatalError);
}
