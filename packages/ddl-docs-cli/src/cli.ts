import path from 'node:path';
import { runCheckDocs } from './commands/check';
import { runGenerateConceptMap } from './commands/conceptMap';
import { runGenerateDocs } from './commands/generate';
import { runPruneDocs } from './commands/prune';
import type { CheckDocsOptions, GenerateConceptMapCliOptions, GenerateDocsOptions, PruneDocsOptions } from './types';
import { dedupeDdlInputsByInstanceAndPath } from './utils/ddlInputDedupe';

const DEFAULT_DDL_DIRECTORY = 'ztd/ddl';
const DEFAULT_OUT_DIR = path.join('ztd', 'docs', 'tables');

/**
 * Runs ddl-docs-cli command dispatch and executes generate/prune subcommands.
 *
 * @param argv Command-line arguments without the node executable and script path.
 * @returns A promise that resolves when command execution completes.
 * Side effects include console output and filesystem writes/removals via subcommands.
 */
export async function runCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    printHelp('all');
    return;
  }

  if (command === 'help') {
    const target = rest[0];
    if (!target) {
      printHelp('all');
      return;
    }
    if (target === 'generate' || target === 'prune' || target === 'check' || target === 'concept-map') {
      printHelp(target);
      return;
    }
    throw new Error(`Unknown command for help: ${target}`);
  }

  if (command === 'generate') {
    const options = parseGenerateOptions(rest);
    if (!options) {
      return;
    }
    await runGenerateDocs(options);
    return;
  }

  if (command === 'prune') {
    const options = parsePruneOptions(rest);
    if (!options) {
      return;
    }
    await runPruneDocs(options);
    return;
  }

  if (command === 'check') {
    const options = parseCheckOptions(rest);
    if (!options) {
      return;
    }
    runCheckDocs(options);
    return;
  }

  if (command === 'concept-map') {
    const options = parseConceptMapOptions(rest);
    if (!options) {
      return;
    }
    runGenerateConceptMap(options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function parseGenerateOptions(args: string[]): GenerateDocsOptions | null {
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
    labelSeparator: undefined,
    locale: undefined,
    dictionaryPath: undefined,
    tableDocsPath: undefined,
    relationshipPath: undefined,
    conceptRelationshipPath: undefined,
    configPath: undefined,
    defaultSchema: undefined,
    searchPath: undefined,
  };

  let currentInstance = '';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--ddl-instance') {
      currentInstance = readRequiredValue(args, ++index, '--ddl-instance');
      continue;
    }

    if (arg === '--ddl-dir') {
      options.ddlDirectories.push({ path: readRequiredValue(args, ++index, '--ddl-dir'), instance: currentInstance });
      continue;
    }

    if (arg === '--ddl-file') {
      options.ddlFiles.push({ path: readRequiredValue(args, ++index, '--ddl-file'), instance: currentInstance });
      continue;
    }

    if (arg === '--ddl') {
      options.ddlFiles.push({ path: readRequiredValue(args, ++index, '--ddl'), instance: currentInstance });
      continue;
    }

    if (arg === '--ddl-glob') {
      options.ddlGlobs.push({ path: readRequiredValue(args, ++index, '--ddl-glob'), instance: currentInstance });
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
    if (arg === '--table-docs') {
      options.tableDocsPath = readRequiredValue(args, ++index, '--table-docs');
      continue;
    }
    if (arg === '--relationship') {
      options.relationshipPath = readRequiredValue(args, ++index, '--relationship');
      continue;
    }
    if (arg === '--concept-relationship') {
      options.conceptRelationshipPath = readRequiredValue(args, ++index, '--concept-relationship');
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

    if (arg === '--label-separator') {
      options.labelSeparator = readRequiredValue(args, ++index, '--label-separator');
      continue;
    }

    if (arg === '--filter-pg-dump') {
      options.filterPgDump = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp('generate');
      return null;
    }

    throw new Error(`Unknown option for generate: ${arg}`);
  }

  if (options.ddlDirectories.length === 0 && options.ddlFiles.length === 0 && options.ddlGlobs.length === 0) {
    options.ddlDirectories = [{ path: DEFAULT_DDL_DIRECTORY, instance: '' }];
  }

  options.ddlDirectories = dedupeDdlInputsByInstanceAndPath(options.ddlDirectories);
  options.ddlFiles = dedupeDdlInputsByInstanceAndPath(options.ddlFiles);
  options.ddlGlobs = dedupeDdlInputsByInstanceAndPath(options.ddlGlobs);
  options.extensions = dedupe(options.extensions);
  return options;
}

function parseConceptMapOptions(args: string[]): GenerateConceptMapCliOptions | null {
  const options: Partial<GenerateConceptMapCliOptions> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--concept-relationship') {
      options.conceptRelationshipPath = readRequiredValue(args, ++index, '--concept-relationship');
      continue;
    }
    if (arg === '--out') {
      options.outPath = readRequiredValue(args, ++index, '--out');
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp('concept-map');
      return null;
    }
    throw new Error(`Unknown option for concept-map: ${arg}`);
  }

  if (!options.conceptRelationshipPath) {
    throw new Error('concept-map requires --concept-relationship.');
  }
  if (!options.outPath) {
    throw new Error('concept-map requires --out.');
  }
  return options as GenerateConceptMapCliOptions;
}

function parseCheckOptions(args: string[]): CheckDocsOptions | null {
  const options: CheckDocsOptions = {
    ddlDirectories: [],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    tableDocsPath: undefined,
    relationshipPath: undefined,
    orderPath: undefined,
    conceptRelationshipPath: undefined,
    conceptMapPath: undefined,
    dfdRelationshipPath: undefined,
    processDirectories: [],
    configPath: undefined,
    defaultSchema: undefined,
    searchPath: undefined,
  };

  let currentInstance = '';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--ddl-instance') {
      currentInstance = readRequiredValue(args, ++index, '--ddl-instance');
      continue;
    }

    if (arg === '--ddl-dir') {
      options.ddlDirectories.push({ path: readRequiredValue(args, ++index, '--ddl-dir'), instance: currentInstance });
      continue;
    }

    if (arg === '--ddl-file' || arg === '--ddl') {
      options.ddlFiles.push({ path: readRequiredValue(args, ++index, arg), instance: currentInstance });
      continue;
    }

    if (arg === '--ddl-glob') {
      options.ddlGlobs.push({ path: readRequiredValue(args, ++index, '--ddl-glob'), instance: currentInstance });
      continue;
    }

    if (arg === '--extensions') {
      options.extensions = parseExtensions(readRequiredValue(args, ++index, '--extensions'));
      continue;
    }

    if (arg === '--config') {
      options.configPath = readRequiredValue(args, ++index, '--config');
      continue;
    }

    if (arg === '--table-docs') {
      options.tableDocsPath = readRequiredValue(args, ++index, '--table-docs');
      continue;
    }

    if (arg === '--relationship') {
      options.relationshipPath = readRequiredValue(args, ++index, '--relationship');
      continue;
    }

    if (arg === '--order') {
      options.orderPath = readRequiredValue(args, ++index, '--order');
      continue;
    }

    if (arg === '--concept-relationship') {
      options.conceptRelationshipPath = readRequiredValue(args, ++index, '--concept-relationship');
      continue;
    }

    if (arg === '--concept-map') {
      options.conceptMapPath = readRequiredValue(args, ++index, '--concept-map');
      continue;
    }

    if (arg === '--dfd-relationship') {
      options.dfdRelationshipPath = readRequiredValue(args, ++index, '--dfd-relationship');
      continue;
    }

    if (arg === '--process-dir') {
      options.processDirectories?.push(readRequiredValue(args, ++index, '--process-dir'));
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

    if (arg === '--filter-pg-dump') {
      options.filterPgDump = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp('check');
      return null;
    }

    throw new Error(`Unknown option for check: ${arg}`);
  }

  if (options.ddlDirectories.length === 0 && options.ddlFiles.length === 0 && options.ddlGlobs.length === 0) {
    options.ddlDirectories = [{ path: DEFAULT_DDL_DIRECTORY, instance: '' }];
  }

  options.ddlDirectories = dedupeDdlInputsByInstanceAndPath(options.ddlDirectories);
  options.ddlFiles = dedupeDdlInputsByInstanceAndPath(options.ddlFiles);
  options.ddlGlobs = dedupeDdlInputsByInstanceAndPath(options.ddlGlobs);
  options.extensions = dedupe(options.extensions);
  return options;
}

function parsePruneOptions(args: string[]): PruneDocsOptions | null {
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
      printHelp('prune');
      return null;
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

function printHelp(target: 'all' | 'generate' | 'prune' | 'check' | 'concept-map'): void {
  const generateHelp = `ddl-docs generate [options]
  --ddl-instance <name>   DB instance name for subsequent --ddl-dir/--ddl-file/--ddl-glob (repeatable)
  --ddl-dir <directory>   Recursively scan DDL files under directory (repeatable)
  --ddl-file <file>       Include explicit DDL file (repeatable)
  --ddl <file>            Alias of --ddl-file
  --ddl-glob <pattern>    Glob pattern for DDL files (repeatable)
  --extensions <list>     Comma-separated extensions (default: .sql)
  --out-dir <directory>   Output root directory (default: ztd/docs/tables)
  --config <path>         Optional ztd.config.json path
  --dictionary <path>     Optional column dictionary json
  --table-docs <path>     Optional table documentation metadata json
  --relationship <path>   Optional DDL relationship metadata json
  --concept-relationship <path> Optional concept relationship registry json
  --locale <code>         Dictionary locale (fallback: LANG -> en -> first)
  --default-schema <name> Override default schema for unqualified tables
  --search-path <list>    Comma-separated schema search path
  --no-index              Skip schema/table index page generation
  --strict                Exit non-zero when warnings exist
  --column-order <mode>   Column order: definition|name (default: definition)
  --label-separator <pat> Regex to split comment into Label+Comment columns (if omitted, no Label column)
  --filter-pg-dump        Strip GRANT/REVOKE/OWNER TO/SET/\\connect statements from pg_dump output
`;

  const pruneHelp = `ddl-docs prune [options]
  --out-dir <directory>   Output root directory (default: ztd/docs/tables)
  --dry-run               Print deletion targets without deleting files
  --prune-orphans         Also prune generated markdown not listed in manifest
`;

  const checkHelp = `ddl-docs check [options]
  --ddl-instance <name>          DB instance name for subsequent --ddl-dir/--ddl-file/--ddl-glob (repeatable)
  --ddl-dir <directory>          Recursively scan DDL files under directory (repeatable)
  --ddl-file <file>              Include explicit DDL file (repeatable)
  --ddl <file>                   Alias of --ddl-file
  --ddl-glob <pattern>           Glob pattern for DDL files (repeatable)
  --extensions <list>            Comma-separated extensions (default: .sql)
  --config <path>                Optional ztd.config.json path
  --table-docs <path>            Optional table documentation metadata json
  --relationship <path>          Optional DDL relationship metadata json
  --order <path>                 Optional DDL execution order metadata json
  --concept-relationship <path>  Optional concept relationship registry json
  --concept-map <path>           Optional generated Concept Map markdown to compare
  --dfd-relationship <path>      Optional DFD relationship metadata json
  --process-dir <directory>      Optional Process Map directory for logical-model checks (repeatable)
  --default-schema <name>        Override default schema for unqualified tables
  --search-path <list>           Comma-separated schema search path
  --filter-pg-dump               Strip GRANT/REVOKE/OWNER TO/SET/\\connect statements from pg_dump output
`;

  const conceptMapHelp = `ddl-docs concept-map [options]
  --concept-relationship <path>  Concept relationship registry json
  --out <path>                   Output concept-map markdown path
`;

  if (target === 'generate') {
    console.log(generateHelp);
    return;
  }
  if (target === 'prune') {
    console.log(pruneHelp);
    return;
  }
  if (target === 'check') {
    console.log(checkHelp);
    return;
  }
  if (target === 'concept-map') {
    console.log(conceptMapHelp);
    return;
  }

  console.log(`ddl-docs <command> [options]

Commands:
  generate               Generate markdown docs from DDL
  prune                  Remove stale generated markdown docs
  check                  Check DDL review metadata references
  concept-map            Generate concept-map markdown from concept metadata
  help [command]         Show help for all commands or one command

${generateHelp}
${pruneHelp}
${checkHelp}
${conceptMapHelp}`);
}
