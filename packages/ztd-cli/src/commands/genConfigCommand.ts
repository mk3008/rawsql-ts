import path from 'node:path';
import { Command } from 'commander';
import {
  collectDirectories,
  DEFAULT_EXTENSIONS,
  DEFAULT_TESTS_DIRECTORY,
  normalizeDirectoryList,
  parseCsvList,
  parseExtensions,
  resolveExtensions
} from './options';
import { runGenerateZtdConfig } from './ztdConfig';

const DEFAULT_GEN_CONFIG_DDL_DIRECTORY = path.join('ddl', 'schemas');
const DEFAULT_GEN_CONFIG_OUTPUT = path.join(DEFAULT_TESTS_DIRECTORY, 'ztd-config.ts');

export function registerGenConfigCommand(program: Command): void {
  program
    .command('gen-config')
    .description('Generate the canonical ztd-config.ts row map for playground projects')
    .option('--ddl-dir <directory>', 'DDL directory to scan (repeatable)', collectDirectories, [])
    .option('--extensions <list>', 'Comma-separated extensions to include', parseExtensions, DEFAULT_EXTENSIONS)
    .option('--out <file>', 'Destination TypeScript file', DEFAULT_GEN_CONFIG_OUTPUT)
    .option('--default-schema <schema>', 'Default schema used when resolving unqualified tables')
    .option('--search-path <list>', 'Comma-separated schema search path entries', parseCsvList)
    .action((options) => {
      // Normalize input directories while defaulting to the playground layout when none are provided.
      const directories = normalizeDirectoryList(
        options.ddlDir as string[],
        DEFAULT_GEN_CONFIG_DDL_DIRECTORY
      );
      const extensions = resolveExtensions(options.extensions as string[], DEFAULT_EXTENSIONS);
      const output = options.out ?? DEFAULT_GEN_CONFIG_OUTPUT;

      runGenerateZtdConfig({
        directories,
        extensions,
        out: output,
        defaultSchema: options.defaultSchema,
        searchPath: options.searchPath
      });
    });
}
