import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import {
  ensureAdapterNodePgModule,
  ensurePgModule,
  ensureTestkitCoreModule,
  type PgClientLike,
  type PgTestkitClientLike,
} from '../utils/optionalDependencies';
import { buildProbeSql, mapDeclaredPgTypeToTs, probeQueryColumns, type ProbedColumn } from '../utils/modelProbe';
import { bindModelGenNamedSql } from '../utils/modelGenBinder';
import {
  deriveModelGenNames,
  normalizeGeneratedSqlFile,
  renderModelGenFile,
  toModelPropertyName,
  type ModelGenFormat
} from '../utils/modelGenRender';
import { ModelGenSqlScanError, scanModelGenSql, type PlaceholderMode, type SqlScanResult } from '../utils/modelGenScanner';
import {
  discoverProjectSqlCatalogSpecFiles,
  loadSqlCatalogSpecsFromFile,
} from '../utils/sqlCatalogDiscovery';
import {
  resolveExplicitCliConnection,
  resolveZtdOwnedCliConnection,
  type ConnectionCliOptions
} from './connectionOptions';
import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';
import { isJsonOutput, parseJsonPayload, writeCommandEnvelope } from '../utils/agentCli';
import { validateProjectPath, validateResourceIdentifier } from '../utils/agentSafety';
import { emitDecisionEvent, withSpan, withSpanSync } from '../utils/telemetry';

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
  dryRun?: boolean;
  describeOutput?: boolean;
  json?: string;
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

interface ResolvedModelGenInputs {
  derivedNames: {
    interfaceName: string;
    mappingName: string;
    specName: string;
    specId: string;
  };
  format: ModelGenFormat;
  probeMode: ModelGenProbeMode;
  relativeSqlFile: string;
  sqlFile: string;
}

export const MODEL_GEN_SPAN_NAMES = {
  resolveInputs: 'resolve-model-gen-inputs',
  placeholderScan: 'placeholder-scan',
  probeClientConnect: 'probe-client-connect',
  probeQueryColumns: 'probe-query-columns',
  typeInference: 'type-inference',
  renderOutput: 'render-generated-output',
  fileEmit: 'file-emit',
} as const;

interface ModelGenZtdProbeInput {
  ddlDir?: string;
  rootDir?: string;
}

export async function runModelGen(sqlFilePath: string, options: ModelGenCommandOptions): Promise<string> {
  const resolved = withSpanSync(MODEL_GEN_SPAN_NAMES.resolveInputs, () => {
    return resolveModelGenInputs(sqlFilePath, options);
  }, {
    format: options.format ?? 'spec',
    hasOut: Boolean(options.out),
  });

  emitDecisionEvent('model-gen.probe-mode', {
    probeMode: resolved.probeMode,
  });

  const placeholderPlan = withSpanSync(MODEL_GEN_SPAN_NAMES.placeholderScan, () => {
    const sqlSource = readFileSync(resolved.sqlFile, 'utf8');
    const scan = scanOrThrow(sqlSource, resolved.sqlFile, Boolean(options.allowPositional));
    const bound = bindProbeSql(sqlSource, scan, Boolean(options.allowPositional));

    if (options.debugProbe) {
      printProbeDebug(
        resolved.sqlFile,
        scan.mode,
        bound.boundSql,
        bound.orderedParamNames,
        Boolean(options.allowPositional),
        resolved.probeMode,
        options.ddlDir
      );
    }

    return {
      bound,
      scan,
    };
  }, {
    allowPositional: Boolean(options.allowPositional),
  });

  const probeClient = await withSpan(MODEL_GEN_SPAN_NAMES.probeClientConnect, async () => {
    const connection = resolveCliConnectionWithProbeGuidance(options, resolved.probeMode);
    return createProbeClient(resolved.probeMode, connection.url, options);
  }, {
    probeMode: resolved.probeMode,
  });

  try {
    const probedColumns = await withSpan(MODEL_GEN_SPAN_NAMES.probeQueryColumns, async () => {
      try {
        return await probeQueryColumns(
          probeClient.queryable,
          placeholderPlan.bound.boundSql,
          placeholderPlan.bound.orderedParamNames.map(() => null),
          { direct: resolved.probeMode === 'ztd' }
        );
      } catch (error) {
        const fallbackColumns = await tryInferZtdReturningColumnsFromDdl({
          error,
          probeMode: resolved.probeMode,
          rootDir: process.cwd(),
          ddlDir: options.ddlDir,
          boundSql: placeholderPlan.bound.boundSql,
        });
        if (fallbackColumns) {
          return fallbackColumns;
        }
        throw error;
      }
    }, {
      paramCount: placeholderPlan.bound.orderedParamNames.length,
      probeMode: resolved.probeMode,
    });

    const columns = withSpanSync(MODEL_GEN_SPAN_NAMES.typeInference, () => {
      const inferredColumns = probedColumns.map((column) => ({
        columnName: column.columnName,
        propertyName: toModelPropertyName(column.columnName),
        tsType: column.tsType
      }));
      assertUniqueProperties(inferredColumns.map((column) => column.propertyName));
      return inferredColumns;
    }, {
      columnCount: probedColumns.length,
    });

    const rendered = withSpanSync(MODEL_GEN_SPAN_NAMES.renderOutput, () => {
      return renderModelGenFile({
        command: buildCommandText(sqlFilePath, options),
        format: resolved.format,
        sqlContractImport: resolveSqlContractImportSpecifier(options),
        sqlFile: resolved.relativeSqlFile,
        specId: resolved.derivedNames.specId,
        interfaceName: resolved.derivedNames.interfaceName,
        mappingName: resolved.derivedNames.mappingName,
        specName: resolved.derivedNames.specName,
        placeholderMode: placeholderPlan.scan.mode,
        allowPositional: Boolean(options.allowPositional),
        orderedParamNames: placeholderPlan.bound.orderedParamNames,
        columns
      });
    }, {
      format: resolved.format,
    });

    if (options.out && !options.dryRun) {
      const outFile = options.out;
      withSpanSync(MODEL_GEN_SPAN_NAMES.fileEmit, () => {
        const absoluteOut = validateProjectPath(outFile, '--out');
        mkdirSync(path.dirname(absoluteOut), { recursive: true });
        writeFileSync(absoluteOut, rendered, 'utf8');
      }, {
        outFile: normalizeCliPath(outFile),
      });
    }

    return rendered;
  } finally {
    await probeClient.close();
  }
}

export function registerModelGenCommand(program: Command): void {
  program
    .command('model-gen <sql-file>')
    .description('Generate QuerySpec output scaffolds from feature-local or shared SQL assets using ZTD-backed inspection or explicit target inspection metadata')
    .option('--out <file>', 'Write the generated scaffold to a TypeScript file')
    .option('--format <format>', 'Output format (spec, row-mapping, interface)', 'spec')
    .option('--sql-root <dir>', 'Compatibility helper for shared SQL roots; feature-local SQL resolves naturally without it')
    .option('--allow-positional', 'Allow legacy positional placeholders ($1, $2, ...) for this run')
    .option('--probe-mode <mode>', 'Inspection source: live or ztd (default: live for backward compatibility; prefer ztd for the fast loop)', 'live')
    .option('--ddl-dir <dir>', 'DDL directory override for --probe-mode ztd (default: ztd.config.json ddlDir)')
    .option('--import-style <style>', 'Generated sql-contract import style: package or relative (default: package)', 'package')
    .option('--import-from <specifier>', 'Override the module specifier used for sql-contract imports in generated files')
    .option('--debug-probe', 'Print the bound inspection SQL and ordered parameter names to stderr before inspection')
    .option('--dry-run', 'Validate inspection and render output metadata without writing the generated file')
    .option('--describe-output', 'Describe the generated artifact contract and exit')
    .option('--json <payload>', 'Pass model-gen options as a JSON object')
    .option('--url <databaseUrl>', 'Explicit target database URL for live inspection (preferred over --db-*)')
    .option('--db-host <host>', 'Explicit target database host when --url is not used')
    .option('--db-port <port>', 'Explicit target database port (defaults to 5432)')
    .option('--db-user <user>', 'Explicit target database user')
    .option('--db-password <password>', 'Explicit target database password')
    .option('--db-name <name>', 'Explicit target database name')
    .addHelpText(
      'after',
      `
Notes:
  - In VSA layouts, pass the feature-local SQL file directly and keep the generated spec next to it.
  - model-gen derives sqlFile/spec id from the SQL file location by default.
  - Use --sql-root only when the project intentionally keeps SQL under a shared compatibility root.
`
    )
    .action(async (sqlFile: string, options: ModelGenCommandOptions) => {
      const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
      if (merged.describeOutput) {
        const payload = {
          schemaVersion: 1,
          command: 'model-gen',
          fileRules: {
            supportsFeatureLocalSql: true,
            // This array documents the recommended VSA mental model exposed to users.
            // resolveRenderedSqlFileReference may still check explicitSqlRoot first
            // for shared-layout compatibility before falling back to these defaults.
            sqlResolutionConceptualOrder: [
              'spec-relative-from-out',
              'project-relative',
              'explicit-sql-root',
              'legacy-src-sql'
            ],
            explicitSqlRootIsCompatibilityHelper: true,
            detectsStableSpecIdCollisions: true
          },
          outputs: {
            spec: 'TypeScript QuerySpec scaffold',
            'row-mapping': 'TypeScript row mapping object',
            interface: 'TypeScript row interface'
          },
          writeBehavior: merged.out
            ? { writesTo: validateProjectPath(String(merged.out), '--out'), dryRun: Boolean(merged.dryRun) }
            : { writesTo: null, dryRun: Boolean(merged.dryRun) }
        };
        if (isJsonOutput()) {
          writeCommandEnvelope('model-gen describe-output', payload);
        } else {
          process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        }
        return;
      }

      const rendered = await runModelGen(validateProjectPath(sqlFile, '<sql-file>'), {
        ...merged,
        ddlDir: merged.ddlDir ? validateProjectPath(String(merged.ddlDir), '--ddl-dir') : undefined,
        importFrom: merged.importFrom ? validateImportFrom(String(merged.importFrom)) : undefined,
        out: merged.out ? validateProjectPath(String(merged.out), '--out') : undefined
      });
      if (isJsonOutput()) {
        writeCommandEnvelope('model-gen', {
          schemaVersion: 1,
          dryRun: Boolean(merged.dryRun),
          outFile: merged.out ? validateProjectPath(String(merged.out), '--out') : null,
          bytes: rendered.length,
          format: merged.format ?? 'spec'
        });
        return;
      }
      if (!merged.out) {
        process.stdout.write(rendered);
      }
    });
}


export function resolveCliConnectionWithProbeGuidance(
  options: ModelGenCommandOptions,
  probeMode: ModelGenProbeMode
) {
  try {
    if (probeMode === 'ztd') {
      return resolveZtdOwnedCliConnection();
    }
    return resolveExplicitCliConnection(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ZTD_DB_URL is required') && probeMode === 'ztd') {
      throw new Error(
        [
          message,
          'model-gen --probe-mode ztd still needs a reachable PostgreSQL connection for ZTD-owned inspection.',
          'Start Docker/service and provide ZTD_DB_URL, then rerun.'
        ].join('\n')
      );
    }
    throw error;
  }
}

function resolveDbConnectTimeoutMs(): number {
  const raw = process.env.ZTD_DB_CONNECT_TIMEOUT_MS?.trim();
  if (!raw) {
    return 3000;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 3000;
  }
  return Math.floor(parsed);
}

export function buildModelGenConnectionFailure(error: unknown, probeMode: ModelGenProbeMode): Error {
  const message = error instanceof Error ? error.message : String(error);
  const modeHint =
    probeMode === 'ztd'
      ? 'Ensure ZTD_DB_URL points to a reachable PostgreSQL instance before ZTD-owned inspection.'
      : 'Ensure --url or a complete --db-* flag set points to a reachable PostgreSQL instance for explicit target inspection.';
  return new Error(`Failed to connect to PostgreSQL for model-gen. ${modeHint} (${message})`);
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

function validateImportFrom(value: string): string {
  const trimmed = validateResourceIdentifier(value, '--import-from');
  return trimmed;
}

function normalizeRealPath(targetPath: string): string {
  const absolute = path.resolve(process.cwd(), targetPath);
  if (!existsSync(absolute)) {
    throw new Error(`File or directory does not exist: ${targetPath}`);
  }
  return realpathSync(absolute);
}

function assertWithinExplicitSqlRoot(sqlRoot: string, sqlFile: string): void {
  const relative = path.relative(sqlRoot, sqlFile);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error([
      `The SQL file is outside the configured sql root: ${sqlFile}.`,
      'model-gen only uses --sql-root as a compatibility helper for shared SQL layouts.',
      'For feature-local SQL, omit --sql-root and let model-gen derive the contract from the file location.',
      `Move the file under ${sqlRoot} or remove --sql-root for feature-local discovery.`
    ].join('\n'));
  }
}

export function resolveModelGenInputs(
  sqlFilePath: string,
  options: Pick<ModelGenCommandOptions, 'format' | 'probeMode' | 'sqlRoot' | 'out'> & { rootDir?: string }
): ResolvedModelGenInputs {
  const rootDir = options.rootDir ?? process.cwd();
  const format = normalizeFormat(options.format);
  const sqlFile = normalizeRealPath(path.isAbsolute(sqlFilePath) ? sqlFilePath : path.resolve(rootDir, sqlFilePath));
  const explicitSqlRoot = options.sqlRoot
    ? normalizeRealPath(path.isAbsolute(options.sqlRoot) ? options.sqlRoot : path.resolve(rootDir, options.sqlRoot))
    : undefined;
  if (explicitSqlRoot) {
    assertWithinExplicitSqlRoot(explicitSqlRoot, sqlFile);
  }

  // Prefer spec-relative sqlFile values when we know where the generated spec
  // will live so VSA slices naturally emit ./query.sql contracts.
  const relativeSqlFile = resolveRenderedSqlFileReference({
    rootDir,
    sqlFile,
    outFile: options.out,
    explicitSqlRoot,
  });

  // Preserve stable names across VSA and shared-root layouts by deriving the
  // identity from the SQL path inside the project instead of a fixed src/sql root.
  const derivedNames = deriveModelGenNames(
    resolveModelGenIdentityPath({
      rootDir,
      sqlFile,
      explicitSqlRoot,
    })
  );
  ensureSpecIdAvailable(rootDir, derivedNames.specId, sqlFile);

  return {
    derivedNames,
    format,
    probeMode: normalizeProbeMode(options.probeMode),
    relativeSqlFile,
    sqlFile,
  };
}

function resolveRenderedSqlFileReference(params: {
  rootDir: string;
  sqlFile: string;
  outFile?: string;
  explicitSqlRoot?: string;
}): string {
  if (params.explicitSqlRoot) {
    return normalizeGeneratedSqlFile(path.relative(params.explicitSqlRoot, params.sqlFile));
  }

  if (params.outFile) {
    const outAbsolute = path.isAbsolute(params.outFile)
      ? params.outFile
      : path.resolve(params.rootDir, params.outFile);
    return normalizeRelativeSpecPath(path.relative(path.dirname(outAbsolute), params.sqlFile));
  }

  return normalizeGeneratedSqlFile(resolveModelGenIdentityPath(params));
}

function resolveModelGenIdentityPath(params: {
  rootDir: string;
  sqlFile: string;
  explicitSqlRoot?: string;
}): string {
  if (params.explicitSqlRoot) {
    return normalizeGeneratedSqlFile(path.relative(params.explicitSqlRoot, params.sqlFile));
  }

  const projectRelative = normalizeGeneratedSqlFile(path.relative(params.rootDir, params.sqlFile));
  if (projectRelative.startsWith('src/features/')) {
    return projectRelative.slice('src/'.length);
  }
  if (projectRelative.startsWith('src/sql/')) {
    return projectRelative.slice('src/sql/'.length);
  }
  if (projectRelative.startsWith('src/')) {
    return projectRelative.slice('src/'.length);
  }
  return projectRelative;
}

function normalizeRelativeSpecPath(relativePath: string): string {
  const normalized = normalizeGeneratedSqlFile(relativePath);
  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    return normalized;
  }
  return `./${normalized}`;
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
  const pgClient = new pgModule.Client({
    connectionString: connectionUrl,
    connectionTimeoutMillis: resolveDbConnectTimeoutMs()
  });
  await pgClient.connect().catch((error) => {
    throw buildModelGenConnectionFailure(error, probeMode);
  });

  if (probeMode === 'live') {
    return {
      queryable: pgClient,
      close: async () => {
        await pgClient.end();
      }
    };
  }

  try {
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
        const results = await Promise.allSettled([
          testkitClient.close(),
          pgClient.end(),
        ]);
        const failure = results.find((result) => result.status === 'rejected');
        if (failure?.status === 'rejected') {
          throw failure.reason;
        }
      }
    };
  } catch (error) {
    await pgClient.end();
    throw error;
  }
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
    defaultSchema: config.defaultSchema,
    searchPath: config.searchPath
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
    '[model-gen] inspection debug',
    `sqlFile: ${normalizeCliPath(sqlFile)}`,
    `placeholderMode: ${mode}`,
    `allowPositional: ${allowPositional}`,
    `probeMode: ${probeMode}`,
    `orderedParamNames: ${JSON.stringify(orderedParamNames)}`,
    'boundSql:',
    boundSql,
    `inspectionSql: ${buildProbeSql(boundSql)}`
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

async function tryInferZtdReturningColumnsFromDdl(params: {
  error: unknown;
  probeMode: ModelGenProbeMode;
  rootDir?: string;
  ddlDir?: string;
  boundSql: string;
}): Promise<ProbedColumn[] | null> {
  if (params.probeMode !== 'ztd') {
    return null;
  }

  const message = params.error instanceof Error ? params.error.message : String(params.error);
  if (!/cannot be resolved for RETURNING output/i.test(message)) {
    return null;
  }

  const ztdOptions = resolveModelGenZtdProbeOptions({
    rootDir: params.rootDir,
    ddlDir: params.ddlDir,
  });
  const fixtureState = await loadModelGenZtdFixtureState(ztdOptions);
  return inferReturningColumnsFromTableDefinitions(
    params.boundSql,
    fixtureState.tableDefinitions,
    ztdOptions.defaultSchema,
    ztdOptions.searchPath
  );
}

export function inferReturningColumnsFromTableDefinitions(
  sql: string,
  tableDefinitions: unknown[],
  defaultSchema: string,
  searchPath: string[]
): ProbedColumn[] | null {
  const normalizedSql = sql.trim().replace(/(?:;\s*)+$/u, '');
  const tableMatch = normalizedSql.match(/^\s*(?:insert\s+into|update|delete\s+from)\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\.(?:"[^"]+"|[A-Za-z_][\w$]*))?)/iu);
  const returningMatch = normalizedSql.match(/\breturning\b([\s\S]+)$/iu);
  if (!tableMatch || !returningMatch) {
    return null;
  }

  const tableIdentifier = parseTableReference(tableMatch[1]);
  if (!tableIdentifier) {
    return null;
  }

  const tableDefinition = resolveTableDefinition(tableDefinitions, tableIdentifier, defaultSchema, searchPath);
  if (!tableDefinition) {
    return null;
  }

  const returningColumns = splitReturningColumns(returningMatch[1]);
  if (returningColumns.length === 0) {
    return null;
  }

  const resolved = returningColumns.map((columnName) => {
    const column = tableDefinition.columns.find((candidate) => candidate.name.toLowerCase() === columnName.toLowerCase());
    if (!column) {
      throw new Error(`Column '${columnName}' cannot be resolved for RETURNING output.`);
    }
    const typeName = typeof column.typeName === 'string' ? column.typeName : 'unknown';
    return {
      columnName: column.name,
      typeName,
      tsType: mapDeclaredPgTypeToTs(typeName),
    };
  });

  return resolved;
}

function splitReturningColumns(source: string): string[] {
  return source
    .split(',')
    .map((segment) => segment.trim())
    .map((segment) => {
      const identifier = parseColumnReference(segment);
      return identifier ? identifier.column : null;
    })
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function parseColumnReference(source: string): { schema?: string; table?: string; column: string } | null {
  const parts = source
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      if (segment.startsWith('"') && segment.endsWith('"')) {
        return segment.slice(1, -1);
      }
      return /^[A-Za-z_][\w$]*$/u.test(segment) ? segment : null;
    });

  if (parts.some((part) => part === null)) {
    return null;
  }

  if (parts.length === 1) {
    return { column: parts[0]! };
  }
  if (parts.length === 2) {
    return { table: parts[0]!, column: parts[1]! };
  }
  if (parts.length === 3) {
    return { schema: parts[0]!, table: parts[1]!, column: parts[2]! };
  }
  return null;
}

function parseTableReference(source: string): { schema?: string; table: string } | null {
  const parts = source
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      if (segment.startsWith('"') && segment.endsWith('"')) {
        return segment.slice(1, -1);
      }
      return /^[A-Za-z_][\w$]*$/u.test(segment) ? segment : null;
    });

  if (parts.some((part) => part === null)) {
    return null;
  }

  if (parts.length === 1) {
    return { table: parts[0]! };
  }
  if (parts.length === 2) {
    return { schema: parts[0]!, table: parts[1]! };
  }
  return null;
}

function resolveTableDefinition(
  tableDefinitions: unknown[],
  identifier: { schema?: string; table: string },
  defaultSchema: string,
  searchPath: string[]
): { name: string; columns: Array<{ name: string; typeName?: string }> } | null {
  const definitions = tableDefinitions
    .filter((definition): definition is { name: string; columns: Array<{ name: string; typeName?: string }> } =>
      typeof (definition as { name?: unknown }).name === 'string' &&
      Array.isArray((definition as { columns?: unknown }).columns)
    );

  const requestedTable = identifier.table;
  const requestedSchema = identifier.schema;
  if (requestedSchema) {
    return (
      definitions.find((definition) => definition.name.toLowerCase() === `${requestedSchema}.${requestedTable}`.toLowerCase()) ??
      definitions.find((definition) => definition.name.toLowerCase() === requestedTable.toLowerCase()) ??
      null
    );
  }

  const candidates = definitions.filter((definition) => definition.name.split('.').pop()?.toLowerCase() === requestedTable.toLowerCase());
  for (const schemaName of [defaultSchema, ...searchPath]) {
    const match = candidates.find((definition) => definition.name.toLowerCase() === `${schemaName}.${requestedTable}`.toLowerCase());
    if (match) {
      return match;
    }
  }

  return candidates[0] ?? null;
}

function ensureSpecIdAvailable(projectRoot: string, specId: string, sourceSqlFile: string): void {
  const specFiles = discoverProjectSqlCatalogSpecFiles(projectRoot, { excludeTestFiles: true });
  for (const specFile of specFiles) {
    const loadedSpecs = loadSqlCatalogSpecsFromFile(specFile, (message) => new Error(message));
    if (loadedSpecs.length > 0) {
      for (const entry of loadedSpecs) {
        if (entry.spec.id !== specId) {
          continue;
        }
        throw new Error([
          `Generated spec id "${specId}" conflicts with an existing spec in ${entry.filePath}.`,
          'model-gen keeps spec ids stable and does not auto-rename collisions.',
          `Rename the SQL file or adjust the --sql-root layout and rerun ztd model-gen for ${sourceSqlFile}.`
        ].join('\n'));
      }
      continue;
    }

    // Preserve the old collision guard for partial/manual spec stubs that may
    // define an id before they become full QuerySpec entries with sqlFile.
    const source = readFileSync(specFile, 'utf8');
    const matches = source.matchAll(/id\s*:\s*['"`]([^'"`]+)['"`]/g);
    for (const match of matches) {
      if (match[1] !== specId) {
        continue;
      }
      throw new Error([
        `Generated spec id "${specId}" conflicts with an existing spec in ${specFile}.`,
        'model-gen keeps spec ids stable and does not auto-rename collisions.',
        `Rename the SQL file or adjust the --sql-root layout and rerun ztd model-gen for ${sourceSqlFile}.`
      ].join('\n'));
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

