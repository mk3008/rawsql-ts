import { existsSync, mkdirSync, readFileSync, realpathSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import {
  ensureAdapterNodePgModule,
  ensurePgModule,
  ensureTestkitCoreModule,
  type PgClientLike,
  type PgTestkitClientLike,
} from '../utils/optionalDependencies';
import { buildProbeSql, probeQueryColumns } from '../utils/modelProbe';
import { bindModelGenNamedSql } from '../utils/modelGenBinder';
import {
  deriveModelGenNames,
  normalizeGeneratedSqlFile,
  renderModelGenFile,
  toModelPropertyName,
  type ModelGenFormat
} from '../utils/modelGenRender';
import { ModelGenSqlScanError, scanModelGenSql, type PlaceholderMode, type SqlScanResult } from '../utils/modelGenScanner';
import { resolveCliConnection, type ConnectionCliOptions } from './connectionOptions';
import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';

interface ModelGenCommandOptions extends ConnectionCliOptions {
  out?: string;
  format?: ModelGenFormat;
  sqlRoot?: string;
  allowPositional?: boolean;
  debugProbe?: boolean;
  probeMode?: ModelGenProbeMode;
  ddlDir?: string;
  importStyle?: ModelGenImportStyle;
  importFrom?: string;
}

type ModelGenProbeMode = 'live' | 'ztd';
type ModelGenImportStyle = 'package' | 'relative';

interface ModelGenZtdProbeOptions {
  ddlDirectories: string[];
  defaultSchema: string;
  searchPath: string[];
}

interface ModelGenZtdFixtureState {
  tableDefinitions: unknown[];
  tableRows: Array<{
    tableName: string;
    rows: Array<Record<string, unknown>>;
  }>;
}

interface ModelGenZtdProbeInput {
  ddlDir?: string;
  rootDir?: string;
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
  const probeMode = normalizeProbeMode(options.probeMode);

  const connection = resolveCliConnection(options);
  const probeClient = await createProbeClient(probeMode, connection.url, options);

  try {
    const bound = bindProbeSql(sqlSource, scan, Boolean(options.allowPositional));
    if (options.debugProbe) {
      printProbeDebug(
        sqlFile,
        scan.mode,
        bound.boundSql,
        bound.orderedParamNames,
        Boolean(options.allowPositional),
        probeMode,
        options.ddlDir
      );
    }

    const columns = await probeQueryColumns(probeClient.queryable, bound.boundSql, bound.orderedParamNames.map(() => null))
      .then((probed) => probed.map((column) => ({
        columnName: column.columnName,
        propertyName: toModelPropertyName(column.columnName),
        tsType: column.tsType
      })));
    assertUniqueProperties(columns.map((column) => column.propertyName));

    const rendered = renderModelGenFile({
      command: buildCommandText(sqlFilePath, options),
      format,
      sqlContractImport: resolveSqlContractImportSpecifier(options),
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
    await probeClient.close();
  }
}

export function registerModelGenCommand(program: Command): void {
  program
    .command('model-gen <sql-file>')
    .description('Generate QuerySpec output scaffolds from a ZTD-backed probe or live PostgreSQL metadata (prefer --probe-mode ztd for the fast loop; positional requires --allow-positional)')
    .option('--out <file>', 'Write the generated scaffold to a TypeScript file')
    .option('--format <format>', 'Output format (spec, row-mapping, interface)', 'spec')
    .option('--sql-root <dir>', 'SQL root used to derive sqlFile and spec id', path.join('src', 'sql'))
    .option('--allow-positional', 'Allow legacy positional placeholders ($1, $2, ...) for this run')
    .option('--probe-mode <mode>', 'Probe source: live or ztd (default: live for backward compatibility; prefer ztd for the fast loop)', 'live')
    .option('--ddl-dir <dir>', 'DDL directory override for --probe-mode ztd (default: ztd.config.json ddlDir)')
    .option('--import-style <style>', 'Generated sql-contract import style: package or relative (default: package)', 'package')
    .option('--import-from <specifier>', 'Override the module specifier used for sql-contract imports in generated files')
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

function normalizeProbeMode(value?: string): ModelGenProbeMode {
  const normalized = (value ?? 'live').trim().toLowerCase();
  if (normalized === 'live' || normalized === 'ztd') {
    return normalized;
  }
  throw new Error(`Unsupported probe mode "${value}". Use one of: live, ztd.`);
}

function normalizeImportStyle(value?: string): ModelGenImportStyle {
  const normalized = (value ?? 'package').trim().toLowerCase();
  if (normalized === 'package' || normalized === 'relative') {
    return normalized;
  }
  throw new Error(`Unsupported import style "${value}". Use one of: package, relative.`);
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

export function bindProbeSql(sqlSource: string, scan: SqlScanResult, allowPositional: boolean): {
  boundSql: string;
  orderedParamNames: string[];
} {
  if (scan.mode === 'named') {
    return bindModelGenNamedSql(sqlSource);
  }
  if (scan.mode === 'positional') {
    if (!allowPositional) {
      throw new Error('Positional placeholders are not allowed without --allow-positional.');
    }
    // Preserve the highest positional slot so sparse placeholders still receive
    // a params array that matches PostgreSQL's indexed placeholder contract.
    const maxPlaceholderIndex = scan.positionalTokens.reduce((max, token) => {
      const numericIndex = Number(token.token.slice(1));
      return Number.isFinite(numericIndex) ? Math.max(max, numericIndex) : max;
    }, 0);
    const orderedParamNames = Array.from({ length: maxPlaceholderIndex }, (_, index) => `$${index + 1}`);
    return { boundSql: sqlSource, orderedParamNames };
  }
  return { boundSql: sqlSource, orderedParamNames: [] };
}

interface ProbeClientHandle {
  queryable: PgClientLike | PgTestkitClientLike;
  close(): Promise<void>;
}

async function createProbeClient(
  probeMode: ModelGenProbeMode,
  connectionUrl: string,
  options: ModelGenCommandOptions
): Promise<ProbeClientHandle> {
  const pgModule = await ensurePgModule();
  const pgClient = new pgModule.Client({ connectionString: connectionUrl });
  await pgClient.connect();

  if (probeMode === 'live') {
    return {
      queryable: pgClient,
      close: async () => {
        await pgClient.end();
      }
    };
  }

  const adapterModule = await ensureAdapterNodePgModule();
  const ztdProbeOptions = resolveModelGenZtdProbeOptions(options);
  const ztdFixtureState = await loadModelGenZtdFixtureState(ztdProbeOptions);
  const testkitClient = adapterModule.createPgTestkitClient({
    connectionFactory: () => pgClient,
    tableDefinitions: ztdFixtureState.tableDefinitions,
    tableRows: ztdFixtureState.tableRows,
    defaultSchema: ztdProbeOptions.defaultSchema,
    searchPath: ztdProbeOptions.searchPath
  });

  return {
    queryable: testkitClient,
    close: async () => {
      await testkitClient.close();
    }
  };
}

export function resolveModelGenZtdProbeOptions(
  options: ModelGenZtdProbeInput
): ModelGenZtdProbeOptions {
  const rootDir = options.rootDir ?? process.cwd();
  const config = loadZtdProjectConfig(rootDir);
  const configuredDir = options.ddlDir ?? config.ddlDir;
  const absoluteDir = path.resolve(rootDir, configuredDir);
  if (!existsSync(absoluteDir)) {
    throw new Error([
      `The DDL directory for --probe-mode ztd was not found: ${configuredDir}.`,
      'model-gen ztd mode needs DDL metadata so it can rewrite the probe query without physical tables.',
      'Create the directory, update ztd.config.json ddlDir, or pass --ddl-dir explicitly.'
    ].join('\n'));
  }
  return {
    ddlDirectories: [absoluteDir],
    defaultSchema: config.ddl.defaultSchema,
    searchPath: config.ddl.searchPath
  };
}

export function resolveSqlContractImportSpecifier(
  options: Pick<ModelGenCommandOptions, 'out' | 'importStyle' | 'importFrom'> & { rootDir?: string }
): string {
  const rootDir = options.rootDir ?? process.cwd();
  if (options.importFrom) {
    return normalizeImportSpecifier(options.importFrom, options.out, rootDir);
  }

  const importStyle = normalizeImportStyle(options.importStyle);
  if (importStyle === 'package') {
    return '@rawsql-ts/sql-contract';
  }

  if (!options.out) {
    throw new Error(
      'Relative sql-contract imports require --out so model-gen can compute the generated file location. Pass --out or use --import-from explicitly.'
    );
  }

  const defaultLocalShim = resolveExistingModulePath(path.resolve(rootDir, 'src', 'local', 'sql-contract'));
  if (!defaultLocalShim) {
    throw new Error(
      'Relative sql-contract imports expect src/local/sql-contract.ts (or .js/.mts/.cts) to exist. Create the shim or pass --import-from explicitly.'
    );
  }

  return normalizeImportSpecifier(defaultLocalShim, options.out, rootDir);
}

function normalizeImportSpecifier(specifier: string, outFile: string | undefined, rootDir: string): string {
  if (!looksLikeFilesystemPath(specifier)) {
    const rootedCandidate = resolveExistingModulePath(path.resolve(rootDir, specifier));
    if (!rootedCandidate) {
      return specifier;
    }
    specifier = rootedCandidate;
  }

  if (!outFile) {
    throw new Error(
      'Filesystem import targets require --out so model-gen can compute a relative module specifier. Pass --out or use a bare package specifier.'
    );
  }

  const resolvedTarget = resolveExistingModulePath(path.isAbsolute(specifier) ? specifier : path.resolve(rootDir, specifier));
  if (!resolvedTarget) {
    throw new Error(`The sql-contract import target was not found: ${specifier}`);
  }

  const absoluteOut = path.resolve(rootDir, outFile);
  const fromDir = path.dirname(absoluteOut);
  const relativePath = path.relative(fromDir, resolvedTarget).replace(/\\/g, '/');
  const withoutExtension = relativePath.replace(/\.(?:[cm]?ts|[cm]?js)$/iu, '');
  return withoutExtension.startsWith('.') ? withoutExtension : `./${withoutExtension}`;
}

function looksLikeFilesystemPath(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(specifier);
}

function resolveExistingModulePath(basePath: string): string | null {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.mts'),
    path.join(basePath, 'index.cts'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.mjs'),
    path.join(basePath, 'index.cjs'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function loadModelGenZtdFixtureState(
  options: ModelGenZtdProbeOptions
): Promise<ModelGenZtdFixtureState> {
  const testkitCore = await ensureTestkitCoreModule();

  // Reuse the shared schema resolver so unqualified references follow the same searchPath precedence as runtime ZTD rewrites.
  const tableNameResolver = new testkitCore.TableNameResolver({
    defaultSchema: options.defaultSchema,
    searchPath: options.searchPath,
  });
  const loader = new testkitCore.DdlFixtureLoader({
    directories: options.ddlDirectories,
    tableNameResolver,
  });
  const ddlFixtures = loader.getFixtures();

  return {
    tableDefinitions: ddlFixtures.map((fixture) => fixture.tableDefinition),
    tableRows: ddlFixtures.map((fixture) => ({
      tableName: fixture.tableDefinition.name,
      rows: fixture.rows ?? [],
    })),
  };
}

function printProbeDebug(
  sqlFile: string,
  mode: PlaceholderMode,
  boundSql: string,
  orderedParamNames: string[],
  allowPositional: boolean,
  probeMode: ModelGenProbeMode,
  ddlDir?: string
): void {
  const lines = [
    '[model-gen] probe debug',
    `sqlFile: ${normalizeCliPath(sqlFile)}`,
    `placeholderMode: ${mode}`,
    `allowPositional: ${allowPositional}`,
    `probeMode: ${probeMode}`,
    `orderedParamNames: ${JSON.stringify(orderedParamNames)}`,
    'boundSql:',
    boundSql,
    `probeSql: ${buildProbeSql(boundSql)}`
  ];
  if (probeMode === 'ztd') {
    const ztdOptions = resolveModelGenZtdProbeOptions({ ddlDir });
    lines.push(`ddlDir: ${normalizeCliPath(ddlDir ?? loadZtdProjectConfig().ddlDir)}`);
    lines.push(`defaultSchema: ${ztdOptions.defaultSchema}`);
    lines.push(`searchPath: ${JSON.stringify(ztdOptions.searchPath)}`);
  }
  process.stderr.write(`${lines.join('\n')}\n`);
}

function buildCommandText(sqlFilePath: string, options: ModelGenCommandOptions): string {
  const segments = ['ztd model-gen', normalizeCliPath(sqlFilePath)];
  if (options.out) {
    segments.push(`--out ${normalizeCliPath(options.out)}`);
  }
  if (options.format && options.format !== 'spec') {
    segments.push(`--format ${options.format}`);
  }
  if (options.sqlRoot && options.sqlRoot !== path.join('src', 'sql')) {
    segments.push(`--sql-root ${normalizeCliPath(options.sqlRoot)}`);
  }
  if (options.allowPositional) {
    segments.push('--allow-positional');
  }
  if (options.probeMode && options.probeMode !== 'live') {
    segments.push(`--probe-mode ${options.probeMode}`);
  }
  if (options.ddlDir) {
    segments.push(`--ddl-dir ${normalizeCliPath(options.ddlDir)}`);
  }
  if (options.importStyle && options.importStyle !== 'package') {
    segments.push(`--import-style ${options.importStyle}`);
  }
  if (options.importFrom) {
    segments.push(`--import-from ${normalizeCliPath(options.importFrom)}`);
  }
  return segments.join(' ');
}

export function normalizeCliPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
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
