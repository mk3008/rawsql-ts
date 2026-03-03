import { existsSync, mkdirSync, readFileSync, realpathSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { ensurePgModule } from '../utils/optionalDependencies';
import { buildProbeSql, probeQueryColumns } from '../utils/modelProbe';
import { bindModelGenNamedSql } from '../utils/modelGenBinder';
import {
  deriveModelGenNames,
  normalizeGeneratedSqlFile,
  renderModelGenFile,
  toModelPropertyName,
  type ModelGenFormat
} from '../utils/modelGenRender';
import { ModelGenSqlScanError, scanModelGenSql, type PlaceholderMode } from '../utils/modelGenScanner';
import { resolveCliConnection, type ConnectionCliOptions } from './connectionOptions';

interface ModelGenCommandOptions extends ConnectionCliOptions {
  out?: string;
  format?: ModelGenFormat;
  sqlRoot?: string;
  allowPositional?: boolean;
  debugProbe?: boolean;
}

export async function runModelGen(sqlFilePath: string, options: ModelGenCommandOptions): Promise<string> {
  const format = normalizeFormat(options.format);
  const sqlRoot = normalizeRealPath(options.sqlRoot ?? path.join('src', 'sql'));
  const sqlFile = normalizeRealPath(sqlFilePath);
  assertWithinSqlRoot(sqlRoot, sqlFile);

  const relativeSqlFile = normalizeGeneratedSqlFile(path.relative(sqlRoot, sqlFile));
  const sqlSource = readFileSync(sqlFile, 'utf8');
  const scan = scanOrThrow(sqlSource, sqlFile, Boolean(options.allowPositional));
  const derivedNames = deriveModelGenNames(relativeSqlFile);
  ensureSpecIdAvailable(path.resolve(process.cwd(), 'src', 'catalog', 'specs'), derivedNames.specId, sqlFile);

  const connection = resolveCliConnection(options);
  const pgModule = await ensurePgModule();
  const client = new pgModule.Client({ connectionString: connection.url });
  await client.connect();

  try {
    const bound = bindProbeSql(sqlSource, scan.mode, Boolean(options.allowPositional));
    if (options.debugProbe) {
      printProbeDebug(sqlFile, scan.mode, bound.boundSql, bound.orderedParamNames, Boolean(options.allowPositional));
    }

    const columns = await probeQueryColumns(client, bound.boundSql, bound.orderedParamNames.map(() => null))
      .then((probed) => probed.map((column) => ({
        columnName: column.columnName,
        propertyName: toModelPropertyName(column.columnName),
        tsType: column.tsType
      })));
    assertUniqueProperties(columns.map((column) => column.propertyName));

    const rendered = renderModelGenFile({
      command: buildCommandText(sqlFilePath, options),
      format,
      sqlFile: relativeSqlFile,
      specId: derivedNames.specId,
      interfaceName: derivedNames.interfaceName,
      mappingName: derivedNames.mappingName,
      specName: derivedNames.specName,
      placeholderMode: scan.mode,
      allowPositional: Boolean(options.allowPositional),
      orderedParamNames: bound.orderedParamNames,
      columns
    });

    if (options.out) {
      const absoluteOut = path.resolve(process.cwd(), options.out);
      mkdirSync(path.dirname(absoluteOut), { recursive: true });
      writeFileSync(absoluteOut, rendered, 'utf8');
    }

    return rendered;
  } finally {
    await client.end();
  }
}

export function registerModelGenCommand(program: Command): void {
  program
    .command('model-gen <sql-file>')
    .description('Generate QuerySpec output scaffolds from a live PostgreSQL database (names-first; positional requires --allow-positional)')
    .option('--out <file>', 'Write the generated scaffold to a TypeScript file')
    .option('--format <format>', 'Output format (spec, row-mapping, interface)', 'spec')
    .option('--sql-root <dir>', 'SQL root used to derive sqlFile and spec id', path.join('src', 'sql'))
    .option('--allow-positional', 'Allow legacy positional placeholders ($1, $2, ...) for this run')
    .option('--debug-probe', 'Print the bound probe SQL and ordered parameter names to stderr before probing')
    .option('--url <databaseUrl>', 'Connection string to use for probing (optional; fallback to env/config)')
    .option('--db-host <host>', 'Database host to use instead of DATABASE_URL')
    .option('--db-port <port>', 'Database port (defaults to 5432)')
    .option('--db-user <user>', 'Database user to connect as')
    .option('--db-password <password>', 'Database password')
    .option('--db-name <name>', 'Database name to connect to')
    .action(async (sqlFile: string, options: ModelGenCommandOptions) => {
      const rendered = await runModelGen(sqlFile, options);
      if (!options.out) {
        process.stdout.write(rendered);
      }
    });
}

function normalizeFormat(format?: string): ModelGenFormat {
  const normalized = (format ?? 'spec').trim().toLowerCase();
  if (normalized === 'spec' || normalized === 'row-mapping' || normalized === 'interface') {
    return normalized;
  }
  throw new Error(`Unsupported format "${format}". Use one of: spec, row-mapping, interface.`);
}

function normalizeRealPath(targetPath: string): string {
  const absolute = path.resolve(process.cwd(), targetPath);
  if (!existsSync(absolute)) {
    throw new Error(`File or directory does not exist: ${targetPath}`);
  }
  return realpathSync(absolute);
}

function assertWithinSqlRoot(sqlRoot: string, sqlFile: string): void {
  const relative = path.relative(sqlRoot, sqlFile);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error([
      `The SQL file is outside the configured sql root: ${sqlFile}.`,
      'model-gen derives sqlFile and spec id relative to --sql-root by policy.',
      `Move the file under ${sqlRoot} or pass the correct --sql-root value.`
    ].join('\n'));
  }
}

function scanOrThrow(sqlSource: string, sqlFile: string, allowPositional: boolean) {
  try {
    const scan = scanModelGenSql(sqlSource);
    if (scan.mode === 'positional' && !allowPositional) {
      throw new Error([
        `Detected positional placeholders ($1, $2, ...) in ${sqlFile}.`,
        'SQL asset files in this workflow must use named parameters (:name) by policy.',
        'Rewrite the SQL to :name placeholders, or rerun ztd model-gen with --allow-positional for legacy SQL.'
      ].join('\n'));
    }
    return scan;
  } catch (error) {
    if (error instanceof ModelGenSqlScanError) {
      const detail =
        error.token.startsWith(':')
          ? 'model-gen currently supports named parameters matching [A-Za-z_][A-Za-z0-9_]*.'
          : 'model-gen currently supports names-first SQL assets using :name only.';
      throw new Error([
        `${error.message.replace(/\.$/u, '')} in ${sqlFile}.`,
        detail,
        'Rename the parameter to a supported :name form and rerun ztd model-gen.'
      ].join('\n'));
    }
    throw error;
  }
}

function bindProbeSql(sqlSource: string, mode: PlaceholderMode, allowPositional: boolean): {
  boundSql: string;
  orderedParamNames: string[];
} {
  if (mode === 'named') {
    return bindModelGenNamedSql(sqlSource);
  }
  if (mode === 'positional') {
    if (!allowPositional) {
      throw new Error('Positional placeholders are not allowed without --allow-positional.');
    }
    const orderedParamNames = Array.from(sqlSource.matchAll(/\$([0-9]+)/g))
      .map((match) => Number(match[1]))
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((left, right) => left - right)
      .map((value) => `$${value}`);
    return { boundSql: sqlSource, orderedParamNames };
  }
  return { boundSql: sqlSource, orderedParamNames: [] };
}

function printProbeDebug(
  sqlFile: string,
  mode: PlaceholderMode,
  boundSql: string,
  orderedParamNames: string[],
  allowPositional: boolean
): void {
  const lines = [
    '[model-gen] probe debug',
    `sqlFile: ${sqlFile}`,
    `placeholderMode: ${mode}`,
    `allowPositional: ${allowPositional}`,
    `orderedParamNames: ${JSON.stringify(orderedParamNames)}`,
    'boundSql:',
    boundSql,
    `probeSql: ${buildProbeSql(boundSql)}`
  ];
  process.stderr.write(`${lines.join('\n')}\n`);
}

function buildCommandText(sqlFilePath: string, options: ModelGenCommandOptions): string {
  const segments = ['ztd model-gen', sqlFilePath];
  if (options.out) {
    segments.push(`--out ${options.out}`);
  }
  if (options.format && options.format !== 'spec') {
    segments.push(`--format ${options.format}`);
  }
  if (options.sqlRoot && options.sqlRoot !== path.join('src', 'sql')) {
    segments.push(`--sql-root ${options.sqlRoot}`);
  }
  if (options.allowPositional) {
    segments.push('--allow-positional');
  }
  return segments.join(' ');
}

function ensureSpecIdAvailable(specsRoot: string, specId: string, sourceSqlFile: string): void {
  if (!existsSync(specsRoot)) {
    return;
  }
  const stack = [specsRoot];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = readdirSync(current);
    for (const entry of entries) {
      const absolute = path.join(current, entry);
      const stat = statSync(absolute);
      if (stat.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!/\.(?:ts|js|mts|cts|json)$/iu.test(entry) || /\.test\./iu.test(entry)) {
        continue;
      }
      const matches = readFileSync(absolute, 'utf8').matchAll(/id\s*:\s*['"`]([^'"`]+)['"`]/g);
      for (const match of matches) {
        if (match[1] === specId) {
          throw new Error([
            `Generated spec id "${specId}" conflicts with an existing spec.`,
            'model-gen keeps spec ids stable and does not auto-rename collisions.',
            `Rename the SQL file or adjust the --sql-root layout and rerun ztd model-gen for ${sourceSqlFile}.`
          ].join('\n'));
        }
      }
    }
  }
}

function assertUniqueProperties(properties: string[]): void {
  const seen = new Set<string>();
  for (const property of properties) {
    if (seen.has(property)) {
      throw new Error(`Duplicate generated property name "${property}" detected. Rename the SQL column aliases before rerunning model-gen.`);
    }
    seen.add(property);
  }
}
