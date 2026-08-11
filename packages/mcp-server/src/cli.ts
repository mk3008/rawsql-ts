#!/usr/bin/env node
import { McpInputError, runRawsqlMcpServer } from './server';

function parseWorkspace(argv: string[]): string {
  if (argv.length === 0) return process.cwd();
  if (argv.length === 2 && argv[0] === '--workspace') return argv[1];
  throw new McpInputError('WORKSPACE_REQUIRED', 'Usage: rawsql-ts-mcp [--workspace <absolute-path>]');
}

async function main(): Promise<void> {
  await runRawsqlMcpServer(parseWorkspace(process.argv.slice(2)));
}

main().catch((error: unknown) => {
  const failure = {
    code: error instanceof McpInputError ? error.code : 'INVALID_INPUT',
    kind: 'invalid_input',
    message: error instanceof Error ? error.message : String(error),
    version: 1,
  };
  process.stderr.write(`${JSON.stringify(failure)}\n`);
  process.exitCode = 1;
});
