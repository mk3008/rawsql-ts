import path from 'node:path';
import { runGenerateDocs } from './commands/generate';
import { runPruneDocs } from './commands/prune';
import type { GenerateDocsOptions, PruneDocsOptions } from './types';

const DEFAULT_DDL_DIRECTORY = 'ztd/ddl';
const DEFAULT_OUT_DIR = path.join('ztd', 'docs', 'tables');

export async function runCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'generate') {
    runGenerateDocs(parseGenerateOptions(rest));
    return;
  }

  if (command === 'prune') {
    runPruneDocs(parsePruneOptions(rest));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function parseGenerateOptions(args: string[]): GenerateDocsOptions {
  const options: GenerateDocsOptions = {
    ddlDirectories: [],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    outDir: DEFAULT_OUT_DIR,
    includeIndexes: true,
    strict: false,
    dialect: 'postgres',
    columnOrder: 'definition',
    locale: undefined,
    dictionaryPath: undefined,
    configPath: undefined,
    defaultSchema: undefined,
    searchPath: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--ddl-dir') {
      options.ddlDirectories.push(readRequiredValue(args, ++index, '--ddl-dir'));
      continue;
    }

    if (arg === '--ddl-file') {
      options.ddlFiles.push(readRequiredValue(args, ++index, '--ddl-file'));
      continue;
    }

    if (arg === '--ddl') {
      options.ddlFiles.push(readRequiredValue(args, ++index, '--ddl'));
      continue;
    }

    if (arg === '--ddl-glob') {
      options.ddlGlobs.push(readRequiredValue(args, ++index, '--ddl-glob'));
      continue;
    }

    if (arg === '--extensions') {
      options.extensions = parseExtensions(readRequiredValue(args, ++index, '--extensions'));
      continue;
    }

    if (arg === '--out-dir') {
      options.outDir = readRequiredValue(args, ++index, '--out-dir');
      continue;
    }

    if (arg === '--config') {
      options.configPath = readRequiredValue(args, ++index, '--config');
      continue;
    }
    if (arg === '--dictionary') {
      options.dictionaryPath = readRequiredValue(args, ++index, '--dictionary');
      continue;
    }
    if (arg === '--locale') {
      options.locale = readRequiredValue(args, ++index, '--locale');
      continue;
    }

    if (arg === '--default-schema') {
      options.defaultSchema = readRequiredValue(args, ++index, '--default-schema');
      continue;
    }

    if (arg === '--search-path') {
      options.searchPath = parseCsvList(readRequiredValue(args, ++index, '--search-path'));
      continue;
    }

    if (arg === '--no-index') {
      options.includeIndexes = false;
      continue;
    }

    if (arg === '--strict') {
      options.strict = true;
      continue;
    }
    if (arg === '--column-order') {
      const value = readRequiredValue(args, ++index, '--column-order');
      if (value !== 'definition' && value !== 'name') {
        throw new Error('--column-order must be "definition" or "name".');
      }
      options.columnOrder = value;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exitCode = 0;
      return options;
    }

    throw new Error(`Unknown option for generate: ${arg}`);
  }

  if (options.ddlDirectories.length === 0 && options.ddlFiles.length === 0) {
    options.ddlDirectories = [DEFAULT_DDL_DIRECTORY];
  }

  options.ddlDirectories = dedupe(options.ddlDirectories);
  options.ddlFiles = dedupe(options.ddlFiles);
  options.ddlGlobs = dedupe(options.ddlGlobs);
  options.extensions = dedupe(options.extensions);
  return options;
}

function parsePruneOptions(args: string[]): PruneDocsOptions {
  const options: PruneDocsOptions = {
    outDir: DEFAULT_OUT_DIR,
    dryRun: false,
    pruneOrphans: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--out-dir') {
      options.outDir = readRequiredValue(args, ++index, '--out-dir');
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--prune-orphans') {
      options.pruneOrphans = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exitCode = 0;
      return options;
    }

    throw new Error(`Unknown option for prune: ${arg}`);
  }

  return options;
}

function readRequiredValue(args: string[], index: number, optionName: string): string {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}`);
  }
  return value;
}

function parseExtensions(rawValue: string): string[] {
  const tokens = rawValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (entry.startsWith('.') ? entry : `.${entry}`))
    .map((entry) => entry.toLowerCase());
  if (tokens.length === 0) {
    throw new Error('Expected at least one extension value.');
  }
  return tokens;
}

function parseCsvList(rawValue: string): string[] {
  return rawValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^"|"$/g, '').toLowerCase());
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function printHelp(): void {
  console.log(`ddl-docs generate [options]
  --ddl-dir <directory>   Recursively scan DDL files under directory (repeatable)
  --ddl-file <file>       Include explicit DDL file (repeatable)
  --ddl <file>            Alias of --ddl-file
  --ddl-glob <pattern>    Glob pattern for DDL files (repeatable)
  --extensions <list>     Comma-separated extensions (default: .sql)
  --out-dir <directory>   Output root directory (default: ztd/docs/tables)
  --config <path>         Optional ztd.config.json path
  --dictionary <path>     Optional column dictionary json
  --locale <code>         Dictionary locale (fallback: LANG -> en -> first)
  --default-schema <name> Override default schema for unqualified tables
  --search-path <list>    Comma-separated schema search path
  --no-index              Skip schema/table index page generation
  --strict                Exit non-zero when warnings exist
  --column-order <mode>   Column order: definition|name (default: definition)

ddl-docs prune [options]
  --out-dir <directory>   Output root directory (default: ztd/docs/tables)
  --dry-run               Print deletion targets without deleting files
  --prune-orphans         Also prune generated markdown not listed in manifest
`);
}
