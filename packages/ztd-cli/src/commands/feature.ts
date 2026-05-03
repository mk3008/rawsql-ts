import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Command } from 'commander';
import {
  CreateTableQuery,
  MultiQuerySplitter,
  SqlFormatter,
  SqlParser,
  type ColumnConstraintDefinition,
  type TableColumnDefinition
} from 'rawsql-ts';
import { emitDiagnostic, isJsonOutput, writeCommandEnvelope } from '../utils/agentCli';
import { ensureDirectory } from '../utils/fs';
import { collectSqlFiles, type SqlSource } from '../utils/collectSqlFiles';
import { inspectImportAliasSupport } from '../utils/importAliasSupport';
import { loadZtdProjectConfig, resolveGeneratedDir } from '../utils/ztdProjectConfig';
import { registerFeatureTestsScaffoldCommand } from './featureTests';

const FEATURE_ACTIONS = ['insert', 'update', 'delete', 'get-by-id', 'list'] as const;
type FeatureAction = (typeof FEATURE_ACTIONS)[number];
const INSERT_DEFAULT_POLICIES = ['explicit-defaults', 'omit-db-defaults'] as const;
type InsertDefaultPolicy = (typeof INSERT_DEFAULT_POLICIES)[number];
const DEFAULT_INSERT_DEFAULT_POLICY: InsertDefaultPolicy = 'explicit-defaults';
const DEFAULT_PAGE_SIZE = 50;
const FEATURE_SHARED_EXECUTOR_IMPORT_PATH = '#features/_shared/featureQueryExecutor.js';
const FEATURE_SHARED_LOAD_SQL_RESOURCE_IMPORT_PATH = '#features/_shared/loadSqlResource.js';
const FIXED_LAYOUT_DESCRIPTION = [
  'src/features/<feature-name>/',
  '  boundary.ts',
  '  tests/',
  '    <feature-name>.boundary.test.ts',
  '  queries/',
  '    <query-name>/',
  '      boundary.ts',
  '      <query-name>.sql',
  '      generated/',
  '        row-mapper.ts',
  '      tests/',
  '        <query-name>.boundary.ztd.test.ts',
  '        boundary-ztd-types.ts',
  '        generated/',
  '          TEST_PLAN.md',
  '          analysis.json',
  '        cases/',
  '  README.md'
].join('\n');

type FeatureCommandOptions = {
  table?: string;
  action?: string;
  featureName?: string;
  insertDefaultPolicy?: string;
  dryRun?: boolean;
  force?: boolean;
  rootDir?: string;
};

type ExistingBoundaryQueryCommandOptions = {
  table?: string;
  action?: string;
  queryName?: string;
  feature?: string;
  boundaryDir?: string;
  insertDefaultPolicy?: string;
  dryRun?: boolean;
  rootDir?: string;
  workingDir?: string;
};

type GeneratedMapperCommandOptions = {
  feature?: string;
  query?: string;
  rootDir?: string;
  dryRun?: boolean;
};

type FeatureScaffoldSourceName = 'generated-metadata' | 'ddl';

interface GeneratedMetadataAssessment {
  source: 'generated-metadata';
  supported: boolean;
  reasons: string[];
  checkedFiles: string[];
}

interface ScaffoldColumnMetadata {
  name: string;
  typeName?: string;
  isNotNull: boolean;
  defaultValue: string | null;
  hasGeneratedIdentity: boolean;
}

interface DdlTableMetadata {
  canonicalName: string;
  schemaName: string;
  tableName: string;
  columns: ScaffoldColumnMetadata[];
  primaryKeyColumns: string[];
}

interface FeatureScaffoldInput {
  source: FeatureScaffoldSourceName;
  table: DdlTableMetadata;
}

interface FeatureScaffoldPaths {
  featureDir: string;
  queryDir: string;
  testsDir: string;
  entryBoundaryTestFile: string;
  entrySpecFile: string;
  querySpecFile: string;
  querySqlFile: string;
  queryGeneratedDir: string;
  queryGeneratedRowMapperFile: string;
  readmeFile: string;
  sharedDir: string;
  featureQueryExecutorFile: string;
  loadSqlResourceFile: string;
}

interface ExistingBoundaryQueryScaffoldPaths {
  boundaryDir: string;
  queriesDir: string;
  queryDir: string;
  querySpecFile: string;
  querySqlFile: string;
  queryGeneratedDir: string;
  queryGeneratedRowMapperFile: string;
  entrySpecFile: string;
  sharedDir: string;
  featureQueryExecutorFile: string;
  loadSqlResourceFile: string;
  createsQueriesDir: boolean;
}

interface FeatureScaffoldResult {
  featureName: string;
  queryName: string;
  action: FeatureAction;
  table: string;
  primaryKeyColumn: string;
  source: FeatureScaffoldSourceName;
  insertDefaultPolicy: InsertDefaultPolicy;
  dryRun: boolean;
  outputs: Array<{ path: string; written: boolean; kind: 'directory' | 'file' }>;
}

interface ExistingBoundaryQueryScaffoldResult {
  boundaryPath: string;
  resolutionSource: 'feature' | 'boundary-dir' | 'cwd';
  queryName: string;
  action: FeatureAction;
  table: string;
  primaryKeyColumn: string;
  source: FeatureScaffoldSourceName;
  insertDefaultPolicy: InsertDefaultPolicy;
  dryRun: boolean;
  outputs: Array<{ path: string; written: boolean; kind: 'directory' | 'file' }>;
}

interface GeneratedMapperSyncResult {
  featureName: string;
  queryNames: string[];
  dryRun: boolean;
  outputs: Array<{ path: string; written: boolean; changed: boolean; kind: 'file' }>;
}

interface GeneratedMapperCheckResult {
  featureName: string;
  queryNames: string[];
  ok: boolean;
  checked: Array<{ path: string; changed: boolean; kind: 'file' }>;
}

type GeneratedMapperMode = 'single' | 'optional' | 'list' | 'hasMany';

interface GeneratedHasManySideMetadata {
  key: string[];
  columns: Record<string, string>;
}

interface GeneratedHasManyCollectionMetadata extends GeneratedHasManySideMetadata {
  property: string;
  presence: string[];
}

interface GeneratedHasManyRelationMetadata {
  kind: 'hasMany';
  root: GeneratedHasManySideMetadata;
  collection: GeneratedHasManyCollectionMetadata;
}

interface GeneratedMapperSpec {
  featureName: string;
  queryName: string;
  queryPascalName: string;
  mode: GeneratedMapperMode;
  fieldNames: string[];
  hasMany?: GeneratedHasManyRelationMetadata;
  boundaryHash: string;
  sqlHash: string;
  boundaryFile: string;
  generatedFile: string;
}

export function registerFeatureCommand(program: Command): void {
  const feature = program.command('feature').description('Scaffold feature-local files from schema metadata');
  registerFeatureTestsScaffoldCommand(feature);
  const featureQuery = feature
    .command('query')
    .description('Add a child query boundary under an existing boundary folder');
  const generatedMapper = feature
    .command('generated-mapper')
    .description('Synchronize machine-owned RFBA generated row mappers');

  feature
    .command('scaffold')
    .description('Scaffold a feature-local CRUD or SELECT boundary skeleton from schema metadata')
    .requiredOption('--table <table>', 'Target table name')
    .requiredOption('--action <action>', 'Feature action template to scaffold (v1 supports insert, update, delete, get-by-id, and list)')
    .option('--feature-name <name>', 'Override the derived feature name')
    .option('--insert-default-policy <policy>', 'INSERT default-column policy: explicit-defaults or omit-db-defaults', DEFAULT_INSERT_DEFAULT_POLICY)
    .option('--dry-run', 'Validate inputs and emit the planned scaffold without writing files', false)
    .option('--force', 'Overwrite scaffold-owned feature files when they already exist', false)
    .action(async (options: FeatureCommandOptions) => {
      const result = await runFeatureScaffoldCommand(options);
      if (isJsonOutput()) {
        writeCommandEnvelope('feature scaffold', result);
        return;
      }

      const lines = [
        `Feature scaffold ${result.dryRun ? 'plan' : 'completed'}: ${result.featureName}`,
        `Action: ${result.action}`,
        `Table: ${result.table}`,
        `Primary key: ${result.primaryKeyColumn}`,
        `Source: ${result.source}`,
        `Insert default policy: ${result.insertDefaultPolicy}`,
        '',
      'Created by CLI:',
      ...result.outputs.map((output) => `- ${output.path}`),
      '',
      'Reserved for AI follow-up (not created by the CLI):',
      `- Run \`ztd feature tests scaffold --feature ${result.featureName}\` after you finish SQL and DTO edits.`,
      `- That command will refresh src/features/${result.featureName}/queries/${result.queryName}/tests/generated/TEST_PLAN.md and analysis.json, while AI-authored cases stay in src/features/${result.featureName}/queries/${result.queryName}/tests/cases/.`
    ];
      process.stdout.write(`${lines.join('\n')}\n`);
    });

  featureQuery
    .command('scaffold')
    .description('Scaffold one additive query boundary under an existing boundary folder without rewriting the parent boundary')
    .requiredOption('--table <table>', 'Target table name for the new query boundary')
    .requiredOption('--action <action>', 'Query action template to scaffold (v1 supports insert, update, delete, get-by-id, and list)')
    .requiredOption('--query-name <name>', 'Name of the query boundary to add under queries/')
    .option('--feature <name>', 'Resolve the target boundary as src/features/<feature-name>')
    .option('--boundary-dir <path>', 'Explicit existing boundary folder path; defaults to the current working directory when omitted')
    .option('--insert-default-policy <policy>', 'INSERT default-column policy: explicit-defaults or omit-db-defaults', DEFAULT_INSERT_DEFAULT_POLICY)
    .option('--dry-run', 'Validate inputs and emit the planned scaffold without writing files', false)
    .action(async (options: ExistingBoundaryQueryCommandOptions) => {
      const result = await runExistingBoundaryQueryScaffoldCommand(options);
      if (isJsonOutput()) {
        writeCommandEnvelope('feature query scaffold', result);
        return;
      }

      const lines = [
        `Existing-boundary query scaffold ${result.dryRun ? 'plan' : 'completed'}: ${result.queryName}`,
        `Boundary: ${result.boundaryPath}`,
        `Resolved by: ${result.resolutionSource}`,
        `Action: ${result.action}`,
        `Table: ${result.table}`,
        `Primary key: ${result.primaryKeyColumn}`,
        `Source: ${result.source}`,
        `Insert default policy: ${result.insertDefaultPolicy}`,
        '',
        'Created by CLI:',
        ...result.outputs.map((output) => `- ${output.path}`),
        '',
        'Reserved for AI/human follow-up (not done by the CLI):',
        '- Wire the new query boundary into the parent boundary explicitly.',
        '- Decide orchestration, transaction boundaries, and response shaping at the parent boundary.'
      ];
      process.stdout.write(`${lines.join('\n')}\n`);
    });

  generatedMapper
    .command('generate')
    .description('Regenerate machine-owned query row mappers from query boundary contracts')
    .requiredOption('--feature <name>', 'Feature name under src/features/<feature-name>')
    .option('--query <name>', 'Limit regeneration to one query under queries/<query-name>')
    .option('--dry-run', 'Check the planned generated mapper updates without writing files', false)
    .action(async (options: GeneratedMapperCommandOptions) => {
      const result = await runFeatureGeneratedMapperGenerateCommand(options);
      if (isJsonOutput()) {
        writeCommandEnvelope('feature generated-mapper generate', result);
        return;
      }

      const lines = [
        `Generated mapper ${result.dryRun ? 'plan' : 'sync'}: ${result.featureName}`,
        '',
        ...result.outputs.map((output) => `- ${output.path}${output.changed ? ' (changed)' : ' (unchanged)'}`)
      ];
      process.stdout.write(`${lines.join('\n')}\n`);
    });

  generatedMapper
    .command('check')
    .description('Fail when machine-owned query row mappers drift from query boundary contracts')
    .requiredOption('--feature <name>', 'Feature name under src/features/<feature-name>')
    .option('--query <name>', 'Limit drift detection to one query under queries/<query-name>')
    .action(async (options: GeneratedMapperCommandOptions) => {
      const result = await runFeatureGeneratedMapperCheckCommand(options);
      if (isJsonOutput()) {
        writeCommandEnvelope('feature generated-mapper check', result);
        return;
      }

      process.stdout.write(`Generated mapper check passed: ${result.featureName}\n`);
    });
}

export async function runFeatureScaffoldCommand(options: FeatureCommandOptions): Promise<FeatureScaffoldResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const action = normalizeFeatureAction(options.action);
  const insertDefaultPolicy = normalizeInsertDefaultPolicy(options.insertDefaultPolicy);
  const config = loadZtdProjectConfig(rootDir);
  const featureName = normalizeFeatureName(
    options.featureName ?? deriveFeatureName(options.table ?? '', action)
  );
  const queryName = deriveQueryName(options.table ?? '', action);

  const generatedMetadataAssessment = assessGeneratedMetadataCapability(rootDir);
  const input = resolveFeatureScaffoldInput({
    projectRoot: rootDir,
    table: options.table ?? '',
    config,
    generatedMetadataAssessment
  });
  const primaryKeyColumn = resolvePrimaryKeyColumn(input.table);
  const paths = buildFeatureScaffoldPaths(rootDir, featureName, queryName);
  const contents = renderFeatureScaffoldFiles({
    rootDir,
    featureName,
    queryName,
    action,
    table: input.table,
    primaryKeyColumn,
    insertDefaultPolicy,
  });
  assertFeatureWriteSafety(paths, options.force === true);
  const sharedOutputs = buildSharedOutputs(rootDir, paths, !options.dryRun);

  const outputs: FeatureScaffoldResult['outputs'] = [
    ...sharedOutputs,
    { path: toProjectRelativePath(rootDir, paths.featureDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.testsDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.queryDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.queryGeneratedDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.entryBoundaryTestFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.entrySpecFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.querySpecFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.querySqlFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.queryGeneratedRowMapperFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.readmeFile), written: !options.dryRun, kind: 'file' },
  ];

  if (options.dryRun) {
    return {
      featureName,
      queryName,
      action,
      table: input.table.canonicalName,
      primaryKeyColumn,
      source: input.source,
      insertDefaultPolicy,
      dryRun: true,
      outputs
    };
  }

  ensureDirectory(paths.sharedDir);
  ensureDirectory(paths.featureDir);
  ensureDirectory(paths.testsDir);
  ensureDirectory(paths.queryDir);
  ensureDirectory(paths.queryGeneratedDir);
  writeFileIfMissing(paths.featureQueryExecutorFile, contents.featureQueryExecutorFile);
  writeFileIfMissing(paths.loadSqlResourceFile, contents.loadSqlResourceFile);
  writeFileIfMissing(paths.entryBoundaryTestFile, contents.entrySpecTestFile);
  writeFeatureFile(paths.entrySpecFile, contents.entrySpecFile, options.force === true);
  writeFeatureFile(paths.querySpecFile, contents.querySpecFile, options.force === true);
  writeFeatureFile(paths.querySqlFile, contents.querySqlFile, options.force === true);
  writeGeneratedFile(paths.queryGeneratedRowMapperFile, contents.queryGeneratedRowMapperFile);
  writeFeatureFile(paths.readmeFile, contents.readmeFile, options.force === true);

  emitDiagnostic({
    code: 'feature-scaffold.ai-follow-up',
    message: `CLI created src/features/${featureName}/tests/ only for the feature-boundary lane. Run feature tests scaffold after SQL and DTO edits to refresh query-local generated analysis and keep AI-authored cases under src/features/${featureName}/queries/${queryName}/tests/cases/.`
  });

  return {
    featureName,
    queryName,
    action,
    table: input.table.canonicalName,
    primaryKeyColumn,
    source: input.source,
    insertDefaultPolicy,
    dryRun: false,
    outputs
  };
}

export async function runExistingBoundaryQueryScaffoldCommand(
  options: ExistingBoundaryQueryCommandOptions
): Promise<ExistingBoundaryQueryScaffoldResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const action = normalizeFeatureAction(options.action);
  const insertDefaultPolicy = normalizeInsertDefaultPolicy(options.insertDefaultPolicy);
  const queryName = normalizeChildQueryName(options.queryName);
  const config = loadZtdProjectConfig(rootDir);
  const generatedMetadataAssessment = assessGeneratedMetadataCapability(rootDir);
  const input = resolveFeatureScaffoldInput({
    projectRoot: rootDir,
    table: options.table ?? '',
    config,
    generatedMetadataAssessment
  });
  const primaryKeyColumn = resolvePrimaryKeyColumn(input.table);
  const resolvedBoundary = resolveExistingBoundaryFolder(rootDir, options);
  assertExistingBoundaryFolderContract(rootDir, resolvedBoundary.boundaryDir);
  const paths = buildExistingBoundaryQueryScaffoldPaths(rootDir, resolvedBoundary.boundaryDir, queryName);
  assertExistingBoundaryQueryWriteSafety(paths);
  const contents = renderExistingBoundaryQueryScaffoldFiles({
    rootDir,
    boundaryDir: resolvedBoundary.boundaryDir,
    boundaryRelativeDir: resolvedBoundary.boundaryPath,
    queryName,
    action,
    table: input.table,
    primaryKeyColumn,
    insertDefaultPolicy
  });

  const outputs: ExistingBoundaryQueryScaffoldResult['outputs'] = [
    ...buildSharedOutputs(rootDir, paths, !options.dryRun),
    ...(paths.createsQueriesDir
      ? [{ path: toProjectRelativePath(rootDir, paths.queriesDir), written: !options.dryRun, kind: 'directory' as const }]
      : []),
    { path: toProjectRelativePath(rootDir, paths.queryDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.queryGeneratedDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.querySpecFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.querySqlFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.queryGeneratedRowMapperFile), written: !options.dryRun, kind: 'file' },
  ];

  if (options.dryRun) {
    return {
      boundaryPath: resolvedBoundary.boundaryPath,
      resolutionSource: resolvedBoundary.resolutionSource,
      queryName,
      action,
      table: input.table.canonicalName,
      primaryKeyColumn,
      source: input.source,
      insertDefaultPolicy,
      dryRun: true,
      outputs
    };
  }

  ensureDirectory(paths.sharedDir);
  ensureDirectory(paths.queriesDir);
  ensureDirectory(paths.queryDir);
  ensureDirectory(paths.queryGeneratedDir);
  writeFileIfMissing(paths.featureQueryExecutorFile, contents.featureQueryExecutorFile);
  writeFileIfMissing(paths.loadSqlResourceFile, contents.loadSqlResourceFile);
  writeFileSync(paths.querySpecFile, contents.querySpecFile, 'utf8');
  writeFileSync(paths.querySqlFile, contents.querySqlFile, 'utf8');
  writeGeneratedFile(paths.queryGeneratedRowMapperFile, contents.queryGeneratedRowMapperFile);

  emitDiagnostic({
    code: 'feature-query-scaffold.parent-follow-up',
    message: `CLI added ${resolvedBoundary.boundaryPath}/queries/${queryName}, but it did not modify ${resolvedBoundary.boundaryPath}/boundary.ts. Wire orchestration explicitly in the parent boundary.`
  });

  return {
    boundaryPath: resolvedBoundary.boundaryPath,
    resolutionSource: resolvedBoundary.resolutionSource,
    queryName,
    action,
    table: input.table.canonicalName,
    primaryKeyColumn,
    source: input.source,
    insertDefaultPolicy,
    dryRun: false,
    outputs
  };
}

export async function runFeatureGeneratedMapperGenerateCommand(
  options: GeneratedMapperCommandOptions
): Promise<GeneratedMapperSyncResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const featureName = normalizeFeatureName(options.feature ?? '');
  const specs = collectGeneratedMapperSpecs(rootDir, featureName, options.query);
  const outputs: GeneratedMapperSyncResult['outputs'] = [];

  for (const spec of specs) {
    const expected = renderGeneratedRowMapperFileFromSpec(spec);
    const previous = existsSync(spec.generatedFile) ? readFileSync(spec.generatedFile, 'utf8') : '';
    const changed = previous !== expected;
    outputs.push({
      path: toProjectRelativePath(rootDir, spec.generatedFile),
      written: !options.dryRun,
      changed,
      kind: 'file'
    });
    if (!options.dryRun) {
      ensureDirectory(path.dirname(spec.generatedFile));
      writeGeneratedFile(spec.generatedFile, expected);
    }
  }

  return {
    featureName,
    queryNames: specs.map((spec) => spec.queryName),
    dryRun: options.dryRun === true,
    outputs
  };
}

export async function runFeatureGeneratedMapperCheckCommand(
  options: GeneratedMapperCommandOptions
): Promise<GeneratedMapperCheckResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const featureName = normalizeFeatureName(options.feature ?? '');
  const specs = collectGeneratedMapperSpecs(rootDir, featureName, options.query);
  const checked: GeneratedMapperCheckResult['checked'] = [];
  const driftedSpecs: GeneratedMapperSpec[] = [];

  for (const spec of specs) {
    const expected = renderGeneratedRowMapperFileFromSpec(spec);
    const previous = existsSync(spec.generatedFile) ? readFileSync(spec.generatedFile, 'utf8') : '';
    const changed = previous !== expected;
    checked.push({
      path: toProjectRelativePath(rootDir, spec.generatedFile),
      changed,
      kind: 'file'
    });
    if (changed) {
      driftedSpecs.push(spec);
    }
  }

  if (driftedSpecs.length > 0) {
    const driftList = driftedSpecs
      .map((spec) => `- ${toProjectRelativePath(rootDir, spec.generatedFile)}`)
      .join('\n');
    const querySuffix = driftedSpecs.length === 1 ? ` --query ${driftedSpecs[0].queryName}` : '';
    throw new Error(
      [
        `Generated row mapper drift detected for feature ${featureName}.`,
        driftList,
        `Run \`ztd feature generated-mapper generate --feature ${featureName}${querySuffix}\` to refresh machine-owned generated files.`
      ].join('\n')
    );
  }

  return {
    featureName,
    queryNames: specs.map((spec) => spec.queryName),
    ok: true,
    checked
  };
}

export function deriveFeatureName(tableName: string, action: string): string {
  const resourceSegment = toFeatureResourceSegment(tableName);
  return `${resourceSegment}-${action.trim().toLowerCase()}`;
}

export function normalizeFeatureAction(action: string | undefined): FeatureAction {
  const normalized = (action ?? '').trim().toLowerCase();
  if (FEATURE_ACTIONS.includes(normalized as FeatureAction)) {
    return normalized as FeatureAction;
  }
  throw new Error(`Unsupported --action value: ${action}. v1 supports only insert, update, delete, get-by-id, and list.`);
}

export function normalizeInsertDefaultPolicy(policy: string | undefined): InsertDefaultPolicy {
  const normalized = (policy ?? DEFAULT_INSERT_DEFAULT_POLICY).trim().toLowerCase();
  if (INSERT_DEFAULT_POLICIES.includes(normalized as InsertDefaultPolicy)) {
    return normalized as InsertDefaultPolicy;
  }
  throw new Error(`Unsupported --insert-default-policy value: ${policy}. Supported policies are explicit-defaults and omit-db-defaults.`);
}

export function normalizeFeatureName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(normalized)) {
    throw new Error(
      'Feature name must use resource-action kebab-case, start with a letter, and look like users-insert.'
    );
  }
  return normalized;
}

export function normalizeChildQueryName(value: string | undefined): string {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error('Query name must use kebab-case, start with a letter, and look like insert-sales-detail.');
  }
  return normalized;
}

export function assessGeneratedMetadataCapability(projectRoot: string): GeneratedMetadataAssessment {
  const config = loadZtdProjectConfig(projectRoot);
  const generatedManifestPath = path.join(projectRoot, resolveGeneratedDir(config), 'ztd-fixture-manifest.generated.ts');
  const reasons: string[] = [];
  if (!existsSync(generatedManifestPath)) {
    reasons.push(`${normalizeCliPath(path.relative(projectRoot, generatedManifestPath))} is missing.`);
    return {
      source: 'generated-metadata',
      supported: false,
      reasons,
      checkedFiles: [normalizeCliPath(generatedManifestPath)]
    };
  }

  const manifestSource = readFileSync(generatedManifestPath, 'utf8');
  if (!manifestSource.includes('tableDefinitions')) {
    reasons.push('generated manifest does not expose tableDefinitions.');
  }
  if (!manifestSource.includes('typeName')) {
    reasons.push('generated manifest does not expose typeName metadata.');
  }
  if (!manifestSource.includes('defaultValue')) {
    reasons.push('generated manifest does not expose defaultValue metadata.');
  }
  reasons.push('generated manifest does not expose explicit primary key identity.');
  reasons.push('generated manifest does not expose composite primary key structure.');
  reasons.push('generated manifest does not expose generated/identity semantics as a scaffold contract.');

  return {
    source: 'generated-metadata',
    supported: false,
    reasons,
    checkedFiles: [normalizeCliPath(generatedManifestPath)]
  };
}

export function resolveFeatureScaffoldInput(params: {
  projectRoot: string;
  table: string;
  config: ReturnType<typeof loadZtdProjectConfig>;
  generatedMetadataAssessment: GeneratedMetadataAssessment;
}): FeatureScaffoldInput {
  const { generatedMetadataAssessment } = params;
  if (generatedMetadataAssessment.supported) {
    throw new Error('Generated metadata runtime input is not implemented yet.');
  }

  const table = loadTableMetadataFromDdl({
    projectRoot: params.projectRoot,
    rawTableName: params.table,
    defaultSchema: params.config.defaultSchema,
    searchPath: params.config.searchPath,
    ddlDir: params.config.ddlDir
  });

  return {
    source: 'ddl',
    table
  };
}

export function resolvePrimaryKeyColumn(table: DdlTableMetadata): string {
  if (table.primaryKeyColumns.length === 0) {
    throw new Error(`Table ${table.canonicalName} must declare exactly one primary key column in v1.`);
  }
  if (table.primaryKeyColumns.length > 1) {
    throw new Error(`Composite primary keys are not supported in v1: ${table.canonicalName}.`);
  }
  return table.primaryKeyColumns[0];
}

function loadTableMetadataFromDdl(params: {
  projectRoot: string;
  rawTableName: string;
  defaultSchema: string;
  searchPath: string[];
  ddlDir: string;
}): DdlTableMetadata {
  const ddlRoot = path.resolve(params.projectRoot, params.ddlDir);
  const sources = collectSqlFiles([ddlRoot], ['.sql']);
  if (sources.length === 0) {
    throw new Error(`No SQL files were discovered under ${params.ddlDir}.`);
  }

  const tables = collectDdlTableMetadata(sources, params.defaultSchema);
  const target = resolveRequestedTable(params.rawTableName, tables, params.defaultSchema, params.searchPath);
  if (!target) {
    throw new Error(`Table not found for scaffold: ${params.rawTableName}.`);
  }
  return target;
}

function collectDdlTableMetadata(sources: SqlSource[], defaultSchema: string): DdlTableMetadata[] {
  const tables = new Map<string, DdlTableMetadata>();
  for (const source of sources) {
    const queries = MultiQuerySplitter.split(source.sql).queries;
    for (const query of queries) {
      if (query.isEmpty) {
        continue;
      }
      const parsed = tryParseCreateTable(query.sql);
      if (!parsed) {
        continue;
      }
      const table = buildDdlTableMetadata(parsed, defaultSchema);
      tables.set(table.canonicalName, table);
    }
  }
  return [...tables.values()].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
}

function tryParseCreateTable(sql: string): CreateTableQuery | null {
  try {
    const parsed = SqlParser.parse(sql);
    return parsed instanceof CreateTableQuery ? parsed : null;
  } catch {
    return null;
  }
}

function buildDdlTableMetadata(query: CreateTableQuery, defaultSchema: string): DdlTableMetadata {
  const schemaName = query.namespaces?.[query.namespaces.length - 1] ?? defaultSchema;
  const tableName = query.tableName.name;
  const columnPrimaryKeys = query.columns
    .filter((column) => hasColumnPrimaryKey(column.constraints))
    .map((column) => column.name.name);
  const tablePrimaryKey = query.tableConstraints
    .find((constraint) => constraint.kind === 'primary-key')
    ?.columns
    ?.map((column) => column.name) ?? [];
  const primaryKeyColumns = dedupeStrings([...columnPrimaryKeys, ...tablePrimaryKey]);

  return {
    canonicalName: `${schemaName}.${tableName}`,
    schemaName,
    tableName,
    primaryKeyColumns,
    columns: query.columns.map((column) => ({
      name: column.name.name,
      typeName: extractTypeName(column),
      isNotNull: column.constraints.some((constraint) => constraint.kind === 'not-null' || constraint.kind === 'primary-key'),
      defaultValue: extractDefaultValue(column.constraints),
      hasGeneratedIdentity: column.constraints.some((constraint) =>
        constraint.kind === 'generated-always-identity' || constraint.kind === 'generated-by-default-identity'
      )
    }))
  };
}

function hasColumnPrimaryKey(constraints: ColumnConstraintDefinition[]): boolean {
  return constraints.some((constraint) => constraint.kind === 'primary-key');
}

function extractTypeName(column: TableColumnDefinition): string | undefined {
  const dataType = column.dataType;
  if (!dataType) {
    return undefined;
  }
  if ('getTypeName' in dataType && typeof dataType.getTypeName === 'function') {
    return dataType.getTypeName();
  }
  if ('value' in dataType && typeof dataType.value === 'string') {
    return dataType.value;
  }
  return undefined;
}

function extractDefaultValue(constraints: ColumnConstraintDefinition[]): string | null {
  const defaultConstraint = constraints.find((constraint) => constraint.kind === 'default');
  if (!defaultConstraint || defaultConstraint.defaultValue == null) {
    return null;
  }
  const value = defaultConstraint.defaultValue;
  if (typeof value === 'string') {
    return value;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toSql' in value &&
    typeof value.toSql === 'function'
  ) {
    return value.toSql();
  }
  try {
    const formatter = new SqlFormatter({ keywordCase: 'none' });
    const { formattedSql } = formatter.format(value);
    return formattedSql;
  } catch (cause) {
    throw new Error(
      `Failed to render a scaffoldable default expression: ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }
}

function resolveRequestedTable(
  rawTableName: string,
  tables: DdlTableMetadata[],
  defaultSchema: string,
  searchPath: string[]
): DdlTableMetadata | undefined {
  const normalized = rawTableName.trim().toLowerCase();
  if (normalized.includes('.')) {
    const canonicalMatch = tables.find((table) => table.canonicalName.toLowerCase() === normalized);
    if (canonicalMatch) {
      return canonicalMatch;
    }
  }

  const candidates = tables.filter((table) => table.tableName.toLowerCase() === normalized);
  if (candidates.length === 0) {
    return undefined;
  }

  const orderedSearchPath = searchPath.map((entry) => entry.toLowerCase());
  for (const schemaName of orderedSearchPath) {
    const match = candidates.find((table) => table.schemaName.toLowerCase() === schemaName);
    if (match) {
      return match;
    }
  }

  if (candidates.length === 1) {
    return candidates[0];
  }
  throw new Error(`Table name is ambiguous: ${rawTableName}. Use a schema-qualified table name.`);
}

function buildFeatureScaffoldPaths(rootDir: string, featureName: string, queryName: string): FeatureScaffoldPaths {
  const featureDir = path.join(rootDir, 'src', 'features', featureName);
  const sharedDir = path.join(rootDir, 'src', 'features', '_shared');
  return {
    featureDir,
    queryDir: path.join(featureDir, 'queries', queryName),
    testsDir: path.join(featureDir, 'tests'),
    entryBoundaryTestFile: path.join(featureDir, 'tests', `${featureName}.boundary.test.ts`),
    entrySpecFile: path.join(featureDir, 'boundary.ts'),
    querySpecFile: path.join(featureDir, 'queries', queryName, 'boundary.ts'),
    querySqlFile: path.join(featureDir, 'queries', queryName, `${queryName}.sql`),
    queryGeneratedDir: path.join(featureDir, 'queries', queryName, 'generated'),
    queryGeneratedRowMapperFile: path.join(featureDir, 'queries', queryName, 'generated', 'row-mapper.ts'),
    readmeFile: path.join(featureDir, 'README.md'),
    sharedDir,
    featureQueryExecutorFile: path.join(sharedDir, 'featureQueryExecutor.ts'),
    loadSqlResourceFile: path.join(sharedDir, 'loadSqlResource.ts')
  };
}

function buildExistingBoundaryQueryScaffoldPaths(
  rootDir: string,
  boundaryDir: string,
  queryName: string
): ExistingBoundaryQueryScaffoldPaths {
  const queriesDir = path.join(boundaryDir, 'queries');
  const queryDir = path.join(queriesDir, queryName);
  const sharedDir = path.join(rootDir, 'src', 'features', '_shared');
  return {
    boundaryDir,
    queriesDir,
    queryDir,
    querySpecFile: path.join(queryDir, 'boundary.ts'),
    querySqlFile: path.join(queryDir, `${queryName}.sql`),
    queryGeneratedDir: path.join(queryDir, 'generated'),
    queryGeneratedRowMapperFile: path.join(queryDir, 'generated', 'row-mapper.ts'),
    entrySpecFile: path.join(boundaryDir, 'boundary.ts'),
    sharedDir,
    featureQueryExecutorFile: path.join(sharedDir, 'featureQueryExecutor.ts'),
    loadSqlResourceFile: path.join(sharedDir, 'loadSqlResource.ts'),
    createsQueriesDir: !existsSync(queriesDir)
  };
}

function renderFeatureScaffoldFiles(params: {
  rootDir: string;
  featureName: string;
  queryName: string;
  action: FeatureAction;
  table: DdlTableMetadata;
  primaryKeyColumn: string;
  insertDefaultPolicy: InsertDefaultPolicy;
}): {
  entrySpecFile: string;
  entrySpecTestFile: string;
  querySpecFile: string;
  querySqlFile: string;
  queryGeneratedRowMapperFile: string;
  readmeFile: string;
  featureQueryExecutorFile: string;
  loadSqlResourceFile: string;
} {
  const sharedImports = resolveFeatureSharedImportPaths(
    params.rootDir,
    path.join(params.rootDir, 'src', 'features', params.featureName, 'queries', params.queryName),
    'Feature scaffold'
  );
  const pascalName = toPascalCase(params.featureName);
  const entryCamelName = toCamelCase(params.featureName);
  const queryPascalName = toPascalCase(params.queryName);
  const queryCamelName = toCamelCase(params.queryName);
  const actionPlan = buildActionPlan(params.action, params.table, params.primaryKeyColumn, params.insertDefaultPolicy);
  const requestFields = actionPlan.requestColumns.map((column) => toRenderField(column, { boundary: 'feature' }));
  const responseFields = actionPlan.resultColumns.map((column) => toRenderField(column, { boundary: 'feature' }));
  const queryRequestFields = actionPlan.requestColumns.map((column) => toRenderField(column, { boundary: 'query' }));
  const queryResponseFields = actionPlan.resultColumns.map((column) => toRenderField(column, { boundary: 'query' }));
  const sqlFile = renderActionSql(actionPlan, params.table.canonicalName, params.primaryKeyColumn);
  const sharedSupportFiles = renderFeatureSharedSupportFiles();
  const entrySpecFile = renderEntrySpecFile({
    action: params.action,
    featureName: params.featureName,
    pascalName,
    entryCamelName,
    queryName: params.queryName,
    queryPascalName,
    queryCamelName,
    requestFields,
    responseFields,
    insertDefaultPolicy: params.insertDefaultPolicy
  });
  const querySpecFile = renderQuerySpecFile({
    action: params.action,
    queryName: params.queryName,
    boundaryRelativeDir: normalizeCliPath(path.join('src', 'features', params.featureName)),
    queryPascalName,
    queryCamelName,
    requestFields: queryRequestFields,
    responseFields: queryResponseFields,
    sharedExecutorImportPath: sharedImports.executorImportPath,
    sharedLoadSqlResourceImportPath: sharedImports.loadSqlResourceImportPath,
    insertDefaultPolicy: params.insertDefaultPolicy
  });
  const queryGeneratedRowMapperFile = renderGeneratedRowMapperFile({
    action: params.action,
    queryPascalName,
    responseFields: queryResponseFields,
    boundarySource: querySpecFile,
    sqlSource: sqlFile
  });
  const readmeFile = renderReadmeFile({
    action: params.action,
    featureName: params.featureName,
    queryName: params.queryName,
    tableName: params.table.canonicalName,
    primaryKeyColumn: params.primaryKeyColumn,
    generatedColumns: params.table.columns
      .filter((column) => isGeneratedInsertColumn(column, params.primaryKeyColumn))
      .map((column) => column.name),
    queryColumns: actionPlan.queryColumns.map((column) => column.name),
    parameterColumns: actionPlan.requestColumns.map((column) => column.name),
    defaultExpressionColumns: actionPlan.queryColumns.filter((column) => column.source === 'ddl-default').map((column) => column.name),
    omittedDefaultColumns: actionPlan.queryColumns.filter((column) => column.source === 'omitted-db-default').map((column) => column.name),
    insertDefaultPolicy: params.insertDefaultPolicy
  });

  return {
    entrySpecFile,
    entrySpecTestFile: renderEntrySpecTestFile({
      featureName: params.featureName,
      queryName: params.queryName,
      pascalName,
      hasRequestFields: requestFields.length > 0
    }),
    querySpecFile,
    querySqlFile: sqlFile,
    queryGeneratedRowMapperFile,
    readmeFile,
    featureQueryExecutorFile: sharedSupportFiles.featureQueryExecutorFile,
    loadSqlResourceFile: sharedSupportFiles.loadSqlResourceFile
  };
}

type RenderField = {
  name: string;
  sourceName: string;
  typeScriptType: string;
  parserKind: 'string' | 'number' | 'boolean' | 'jsonObject';
  nullable: boolean;
  sourceType: string;
};

type QueryColumn = {
  name: string;
  expression: string;
  source: 'param' | 'ddl-default' | 'omitted-db-default' | 'selected';
};

type ActionPlan = {
  action: FeatureAction;
  requestColumns: ScaffoldColumnMetadata[];
  resultColumns: ScaffoldColumnMetadata[];
  queryColumns: QueryColumn[];
  writeColumns: QueryColumn[];
  whereColumns: QueryColumn[];
};

function deriveQueryName(tableName: string, action: FeatureAction): string {
  if (action === 'get-by-id' || action === 'list') {
    return action;
  }
  return `${action}-${toFeatureResourceSegment(tableName)}`;
}

function resolveExistingBoundaryFolder(
  rootDir: string,
  options: ExistingBoundaryQueryCommandOptions
): {
  boundaryDir: string;
  boundaryPath: string;
  resolutionSource: 'feature' | 'boundary-dir' | 'cwd';
} {
  if (options.feature && options.boundaryDir) {
    throw new Error('Use either --feature or --boundary-dir, not both.');
  }

  if (options.feature) {
    const featureName = normalizeFeatureName(options.feature);
    const boundaryDir = path.join(rootDir, 'src', 'features', featureName);
    return {
      boundaryDir,
      boundaryPath: toProjectRelativePath(rootDir, boundaryDir),
      resolutionSource: 'feature'
    };
  }

  if (options.boundaryDir) {
    const boundaryDir = path.resolve(rootDir, options.boundaryDir);
    return {
      boundaryDir,
      boundaryPath: toProjectRelativePath(rootDir, boundaryDir),
      resolutionSource: 'boundary-dir'
    };
  }

  const boundaryDir = options.workingDir ?? process.cwd();
  return {
    boundaryDir,
    boundaryPath: toProjectRelativePath(rootDir, boundaryDir),
    resolutionSource: 'cwd'
  };
}

function collectGeneratedMapperSpecs(rootDir: string, featureName: string, queryName?: string): GeneratedMapperSpec[] {
  const featureDir = path.join(rootDir, 'src', 'features', featureName);
  const queriesDir = path.join(featureDir, 'queries');
  if (!existsSync(queriesDir) || !statSync(queriesDir).isDirectory()) {
    throw new Error(`Feature queries directory not found: ${toProjectRelativePath(rootDir, queriesDir)}.`);
  }

  const queryNames = queryName === undefined
    ? readdirSync(queriesDir)
      .filter((entry) => {
        const candidate = path.join(queriesDir, entry);
        return statSync(candidate).isDirectory() && existsSync(path.join(candidate, 'boundary.ts'));
      })
      .sort()
    : [normalizeChildQueryName(queryName)];

  if (queryNames.length === 0) {
    throw new Error(`No query boundary files were found under ${toProjectRelativePath(rootDir, queriesDir)}.`);
  }

  return queryNames.map((query) => readGeneratedMapperSpec(rootDir, featureName, query));
}

function readGeneratedMapperSpec(rootDir: string, featureName: string, queryName: string): GeneratedMapperSpec {
  const queryDir = path.join(rootDir, 'src', 'features', featureName, 'queries', queryName);
  const boundaryFile = path.join(queryDir, 'boundary.ts');
  const querySqlFile = path.join(queryDir, `${queryName}.sql`);
  const generatedFile = path.join(queryDir, 'generated', 'row-mapper.ts');
  if (!existsSync(boundaryFile) || !statSync(boundaryFile).isFile()) {
    throw new Error(`Query boundary not found: ${toProjectRelativePath(rootDir, boundaryFile)}.`);
  }
  if (!existsSync(querySqlFile) || !statSync(querySqlFile).isFile()) {
    throw new Error(`Query SQL not found: ${toProjectRelativePath(rootDir, querySqlFile)}.`);
  }

  const boundarySource = readFileSync(boundaryFile, 'utf8');
  const sqlSource = readFileSync(querySqlFile, 'utf8');
  const queryPascalName = extractQueryPascalName(boundarySource, rootDir, boundaryFile);
  const fieldNames = extractRowSchemaFieldNames(boundarySource, rootDir, boundaryFile);
  const hasMany = extractGeneratedHasManyMetadata(boundarySource, fieldNames, rootDir, boundaryFile);
  if (fieldNames.length === 0) {
    throw new Error(
      `Cannot generate row mapper for ${toProjectRelativePath(rootDir, boundaryFile)}: RowSchema has no fields.`
    );
  }

  return {
    featureName,
    queryName,
    queryPascalName,
    mode: hasMany ? 'hasMany' : detectGeneratedMapperMode(boundarySource),
    fieldNames,
    hasMany,
    boundaryHash: hashGeneratedMapperSource(boundarySource),
    sqlHash: hashGeneratedMapperSource(sqlSource),
    boundaryFile,
    generatedFile
  };
}

function hashGeneratedMapperSource(source: string): string {
  return createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
}

function extractQueryPascalName(source: string, rootDir: string, boundaryFile: string): string {
  const match = /export type ([A-Za-z][A-Za-z0-9]*)Row = z\.infer<typeof RowSchema>;/.exec(source);
  if (!match) {
    throw new Error(
      `Cannot generate row mapper for ${toProjectRelativePath(rootDir, boundaryFile)}: exported Row type was not found.`
    );
  }
  return match[1];
}

function extractRowSchemaFieldNames(source: string, rootDir: string, boundaryFile: string): string[] {
  const startToken = 'const RowSchema = z.object({';
  const start = source.indexOf(startToken);
  if (start === -1) {
    throw new Error(
      `Cannot generate row mapper for ${toProjectRelativePath(rootDir, boundaryFile)}: RowSchema was not found.`
    );
  }
  const bodyStart = start + startToken.length;
  const end = source.indexOf('\n})', bodyStart);
  if (end === -1) {
    throw new Error(
      `Cannot generate row mapper for ${toProjectRelativePath(rootDir, boundaryFile)}: RowSchema end was not found.`
    );
  }

  const fields: string[] = [];
  for (const line of source.slice(bodyStart, end).split(/\r?\n/)) {
    const match = /^\s*(?:(['"])(.*?)\1|([A-Za-z_$][A-Za-z0-9_$]*))\s*:/.exec(line);
    if (!match) {
      continue;
    }
    fields.push(match[2] ?? match[3]);
  }
  return fields;
}

function detectGeneratedMapperMode(source: string): GeneratedMapperMode {
  if (source.includes('RowsToResult')) {
    return 'list';
  }
  if (source.includes('const QueryResultSchema = RowSchema.nullable();')) {
    return 'optional';
  }
  return 'single';
}

function extractGeneratedHasManyMetadata(
  source: string,
  fieldNames: string[],
  rootDir: string,
  boundaryFile: string
): GeneratedHasManyRelationMetadata | undefined {
  const metadata = extractGeneratedMapperMetadata(source, rootDir, boundaryFile);
  const hasMany = metadata?.relations?.hasMany;
  if (hasMany === undefined) {
    return undefined;
  }
  if (!Array.isArray(hasMany) || hasMany.length !== 1) {
    throw new Error(
      `Cannot generate hasMany row mapper for ${toProjectRelativePath(rootDir, boundaryFile)}: expected exactly one metadata.relations.hasMany entry.`
    );
  }
  const relation = hasMany[0] as GeneratedHasManyRelationMetadata;
  validateGeneratedHasManyMetadata(relation, new Set(fieldNames), rootDir, boundaryFile);
  return relation;
}

function extractGeneratedMapperMetadata(
  source: string,
  rootDir: string,
  boundaryFile: string
): { relations?: { hasMany?: unknown[] } } | undefined {
  const namedMetadata = /(?:export\s+)?const\s+[A-Za-z0-9_$]*GeneratedMapperMetadata\s*=/.exec(source);
  if (!namedMetadata) {
    return undefined;
  }
  const objectStart = source.indexOf('{', namedMetadata.index);
  if (objectStart === -1) {
    return undefined;
  }
  const objectEnd = findMatchingBrace(source, objectStart);
  if (objectEnd === -1) {
    throw new Error(
      `Cannot parse generated mapper metadata for ${toProjectRelativePath(rootDir, boundaryFile)}: metadata object was not closed.`
    );
  }
  const objectText = source.slice(objectStart, objectEnd + 1);
  try {
    return JSON.parse(objectText) as { relations?: { hasMany?: unknown[] } };
  } catch (cause) {
    throw new Error(
      `Cannot parse generated mapper metadata for ${toProjectRelativePath(rootDir, boundaryFile)}: metadata must be JSON-compatible with quoted keys. ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }
}

function findMatchingBrace(source: string, startIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | '`' | undefined;
  let escaped = false;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function validateGeneratedHasManyMetadata(
  relation: GeneratedHasManyRelationMetadata,
  fieldNames: Set<string>,
  rootDir: string,
  boundaryFile: string
): void {
  const context = toProjectRelativePath(rootDir, boundaryFile);
  if (relation?.kind !== 'hasMany') {
    throw new Error(`Cannot generate hasMany row mapper for ${context}: relation kind must be "hasMany".`);
  }
  assertNonEmptyStringArray(relation.root?.key, 'root.key', context);
  assertNonEmptyStringArray(relation.collection?.key, 'collection.key', context);
  assertNonEmptyStringArray(relation.collection?.presence, 'collection.presence', context);
  assertIdentifier(relation.collection?.property, 'collection.property', context);
  assertColumnMap(relation.root?.columns, 'root.columns', fieldNames, context);
  assertColumnMap(relation.collection?.columns, 'collection.columns', fieldNames, context);
  for (const column of [
    ...relation.root.key,
    ...relation.collection.key,
    ...relation.collection.presence,
  ]) {
    if (!fieldNames.has(column)) {
      throw new Error(`Cannot generate hasMany row mapper for ${context}: metadata column "${column}" is not declared in RowSchema.`);
    }
  }
}

function assertNonEmptyStringArray(value: unknown, label: string, context: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`Cannot generate hasMany row mapper for ${context}: metadata.${label} must be a non-empty string array.`);
  }
}

function assertIdentifier(value: unknown, label: string, context: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) {
    throw new Error(`Cannot generate hasMany row mapper for ${context}: metadata.${label} must be an identifier string.`);
  }
}

function assertColumnMap(
  value: unknown,
  label: string,
  fieldNames: Set<string>,
  context: string
): asserts value is Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new Error(`Cannot generate hasMany row mapper for ${context}: metadata.${label} must be a non-empty object.`);
  }
  for (const [property, column] of Object.entries(value)) {
    assertIdentifier(property, `${label} property`, context);
    if (typeof column !== 'string' || !fieldNames.has(column)) {
      throw new Error(`Cannot generate hasMany row mapper for ${context}: metadata.${label}.${property} column "${String(column)}" is not declared in RowSchema.`);
    }
  }
}

function renderExistingBoundaryQueryScaffoldFiles(params: {
  rootDir: string;
  boundaryDir: string;
  boundaryRelativeDir: string;
  queryName: string;
  action: FeatureAction;
  table: DdlTableMetadata;
  primaryKeyColumn: string;
  insertDefaultPolicy: InsertDefaultPolicy;
}): {
  querySpecFile: string;
  querySqlFile: string;
  queryGeneratedRowMapperFile: string;
  featureQueryExecutorFile: string;
  loadSqlResourceFile: string;
} {
  const sharedImports = resolveFeatureSharedImportPaths(
    params.rootDir,
    path.join(params.boundaryDir, 'queries', params.queryName),
    'Feature query scaffold'
  );
  const queryPascalName = toPascalCase(params.queryName);
  const queryCamelName = toCamelCase(params.queryName);
  const actionPlan = buildActionPlan(params.action, params.table, params.primaryKeyColumn, params.insertDefaultPolicy);
  const requestFields = actionPlan.requestColumns.map((column) => toRenderField(column, { boundary: 'query' }));
  const responseFields = actionPlan.resultColumns.map((column) => toRenderField(column, { boundary: 'query' }));
  const sharedSupportFiles = renderFeatureSharedSupportFiles();
  const querySpecFile = renderQuerySpecFile({
    action: params.action,
    queryName: params.queryName,
    boundaryRelativeDir: params.boundaryRelativeDir,
    queryPascalName,
    queryCamelName,
    requestFields,
    responseFields,
    sharedExecutorImportPath: sharedImports.executorImportPath,
    sharedLoadSqlResourceImportPath: sharedImports.loadSqlResourceImportPath,
    insertDefaultPolicy: params.insertDefaultPolicy
  });
  const querySqlFile = renderActionSql(actionPlan, params.table.canonicalName, params.primaryKeyColumn);

  return {
    querySpecFile,
    queryGeneratedRowMapperFile: renderGeneratedRowMapperFile({
      action: params.action,
      queryPascalName,
      responseFields,
      boundarySource: querySpecFile,
      sqlSource: querySqlFile
    }),
    querySqlFile,
    featureQueryExecutorFile: sharedSupportFiles.featureQueryExecutorFile,
    loadSqlResourceFile: sharedSupportFiles.loadSqlResourceFile
  };
}

function assertExistingBoundaryFolderContract(rootDir: string, boundaryDir: string): void {
  const relativeBoundary = toProjectRelativePath(rootDir, boundaryDir);
  if (relativeBoundary.startsWith('..')) {
    throw new Error(`Boundary folder must stay inside the project root: ${boundaryDir}.`);
  }
  if (!existsSync(boundaryDir)) {
    throw new Error(`Existing boundary folder not found: ${relativeBoundary}.`);
  }
  if (!statSync(boundaryDir).isDirectory()) {
    throw new Error(`Boundary target must be a directory: ${relativeBoundary}.`);
  }

  const entrySpecFile = path.join(boundaryDir, 'boundary.ts');
  if (!existsSync(entrySpecFile)) {
    throw new Error(`Boundary folder must contain boundary.ts: ${relativeBoundary}.`);
  }
  if (!statSync(entrySpecFile).isFile()) {
    throw new Error(`Boundary entrypoint must be a file: ${normalizeCliPath(path.join(relativeBoundary, 'boundary.ts'))}.`);
  }

  const queriesDir = path.join(boundaryDir, 'queries');
  if (existsSync(queriesDir) && !statSync(queriesDir).isDirectory()) {
    throw new Error(`Expected queries/ to be a directory under ${relativeBoundary}.`);
  }
}

function assertExistingBoundaryQueryWriteSafety(paths: ExistingBoundaryQueryScaffoldPaths): void {
  if (existsSync(paths.queryDir)) {
    throw new Error(
      `Query boundary already exists: ${normalizeCliPath(path.join(path.basename(paths.boundaryDir), 'queries', path.basename(paths.queryDir)))}.`
    );
  }
}

function resolveFeatureSharedImportPaths(
  rootDir: string,
  queryDir: string,
  commandLabel: string
): {
  executorImportPath: string;
  loadSqlResourceImportPath: string;
} {
  const importAliasSupport = inspectImportAliasSupport(rootDir, {
    packageImportKey: '#features/*.js',
    tsconfigPathKey: '#features/*',
    vitestAliasPrefix: '#features'
  });
  if (importAliasSupport === 'partial') {
    emitDiagnostic({
      code: 'feature-scaffold.partial-alias-fallback',
      severity: 'warning',
      message: `${commandLabel} found partial #features alias configuration. Falling back to relative imports for generated files. Configure package.json#imports, tsconfig.json compilerOptions.paths, and vitest.config.ts resolve.alias together to enable stable #features imports.`
    });
  } else if (importAliasSupport === 'supported') {
    return {
      executorImportPath: FEATURE_SHARED_EXECUTOR_IMPORT_PATH,
      loadSqlResourceImportPath: FEATURE_SHARED_LOAD_SQL_RESOURCE_IMPORT_PATH
    };
  }

  return {
    executorImportPath: normalizeCliPath(
      path.relative(queryDir, path.join(rootDir, 'src', 'features', '_shared', 'featureQueryExecutor.js'))
    ),
    loadSqlResourceImportPath: normalizeCliPath(
      path.relative(queryDir, path.join(rootDir, 'src', 'features', '_shared', 'loadSqlResource.js'))
    )
  };
}

function renderFeatureSharedSupportFiles(): {
  featureQueryExecutorFile: string;
  loadSqlResourceFile: string;
} {
  return {
    featureQueryExecutorFile: [
      '// Shared runtime contract for scaffolded features.',
      '// Inject your DB execution implementation at this seam from the application runtime.',
      'export interface FeatureQueryExecutor {',
      '  query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]>;',
      '}',
      ''
    ].join('\n'),
    loadSqlResourceFile: [
      "import { readFileSync } from 'node:fs';",
      "import path from 'node:path';",
      '',
      'export function loadSqlResource(currentDir: string, relativePath: string): string {',
      "  return readFileSync(path.join(currentDir, relativePath), 'utf8');",
      '}',
      ''
    ].join('\n')
  };
}

function buildActionPlan(
  action: FeatureAction,
  table: DdlTableMetadata,
  primaryKeyColumn: string,
  insertDefaultPolicy: InsertDefaultPolicy
): ActionPlan {
  if (action === 'insert') {
    const queryColumns = selectInsertSqlColumns(table, primaryKeyColumn, insertDefaultPolicy);
    const writeColumns = queryColumns.filter((column) => column.source !== 'omitted-db-default');
    return {
      action,
      requestColumns: table.columns
        .filter((column) => !isGeneratedInsertColumn(column, primaryKeyColumn) && column.defaultValue == null),
      resultColumns: [requireColumn(table, primaryKeyColumn)],
      queryColumns,
      writeColumns,
      whereColumns: []
    };
  }

  if (action === 'update') {
    const primaryKey = requireColumn(table, primaryKeyColumn);
    const mutableColumns = table.columns.filter((column) => !isGeneratedInsertColumn(column, primaryKeyColumn) && column.name !== primaryKeyColumn);
    if (mutableColumns.length === 0) {
      throw new Error(`Update scaffold requires at least one mutable non-primary-key column: ${table.canonicalName}.`);
    }
    const whereColumns = [{ name: primaryKey.name, expression: `:${primaryKey.name}`, source: 'param' as const }];
    const writeColumns = mutableColumns.map((column) => ({ name: column.name, expression: `:${column.name}`, source: 'param' as const }));
    return {
      action,
      requestColumns: [primaryKey, ...mutableColumns],
      resultColumns: [primaryKey],
      queryColumns: [...whereColumns, ...writeColumns],
      writeColumns,
      whereColumns
    };
  }

  const primaryKey = requireColumn(table, primaryKeyColumn);
  const whereColumns = [{ name: primaryKey.name, expression: `:${primaryKey.name}`, source: 'param' as const }];
  if (action === 'delete') {
    return {
      action,
      requestColumns: [primaryKey],
      resultColumns: [primaryKey],
      queryColumns: whereColumns,
      writeColumns: [],
      whereColumns
    };
  }

  if (action === 'get-by-id') {
    return {
      action,
      requestColumns: [primaryKey],
      resultColumns: [...table.columns],
      queryColumns: [
        ...whereColumns,
        ...table.columns.map((column) => ({
          name: column.name,
          expression: quoteSqlIdentifier(column.name),
          source: 'selected' as const
        }))
      ],
      writeColumns: [],
      whereColumns
    };
  }

  return {
    action,
    requestColumns: [],
    resultColumns: [...table.columns],
    queryColumns: table.columns.map((column) => ({
      name: column.name,
      expression: quoteSqlIdentifier(column.name),
      source: 'selected' as const
    })),
    writeColumns: [],
    whereColumns: []
  };
}

function selectInsertSqlColumns(
  table: DdlTableMetadata,
  primaryKeyColumn: string,
  insertDefaultPolicy: InsertDefaultPolicy
): QueryColumn[] {
  return table.columns
    .filter((column) => !isGeneratedInsertColumn(column, primaryKeyColumn))
    .map((column) => ({
      name: column.name,
      expression: column.defaultValue ?? `:${column.name}`,
      source: column.defaultValue == null
        ? 'param'
        : insertDefaultPolicy === 'omit-db-defaults'
          ? 'omitted-db-default'
          : 'ddl-default'
    }));
}

function requireColumn(table: DdlTableMetadata, columnName: string): ScaffoldColumnMetadata {
  const column = table.columns.find((candidate) => candidate.name === columnName);
  if (!column) {
    throw new Error(`Column ${columnName} was not found in ${table.canonicalName}.`);
  }
  return column;
}

function isGeneratedInsertColumn(column: ScaffoldColumnMetadata, primaryKeyColumn: string): boolean {
  if (column.hasGeneratedIdentity) {
    return true;
  }
  if (column.name !== primaryKeyColumn) {
    return false;
  }
  const normalizedType = (column.typeName ?? '').trim().toLowerCase();
  if (
    normalizedType === 'serial'
    || normalizedType === 'serial2'
    || normalizedType === 'serial4'
    || normalizedType === 'serial8'
    || normalizedType === 'bigserial'
    || normalizedType === 'smallserial'
  ) {
    return true;
  }
  return /^nextval\s*\(/i.test(column.defaultValue ?? '');
}

function renderActionSql(plan: ActionPlan, tableName: string, primaryKeyColumn: string): string {
  const quotedTableName = quoteQualifiedIdentifier(tableName);
  const quotedPrimaryKeyColumn = quoteSqlIdentifier(primaryKeyColumn);
  if (plan.action === 'insert') {
    const policyReviewComment = '-- TODO: Review INSERT default-column policy before using this scaffold in production.';
    if (plan.writeColumns.length === 0) {
      return [
        policyReviewComment,
        `insert into ${quotedTableName}`,
        'default values',
        `returning ${quotedPrimaryKeyColumn};`,
        ''
      ].join('\n');
    }

    return [
      policyReviewComment,
      `insert into ${quotedTableName} (`,
      plan.writeColumns.map((column) => `  ${quoteSqlIdentifier(column.name)}`).join(',\n'),
      ') values (',
      plan.writeColumns.map((column) => `  ${column.expression}`).join(',\n'),
      `) returning ${quotedPrimaryKeyColumn};`,
      ''
    ].join('\n');
  }

  if (plan.action === 'update') {
    return [
      `update ${quotedTableName}`,
      'set',
      plan.writeColumns.map((column) => `  ${quoteSqlIdentifier(column.name)} = ${column.expression}`).join(',\n'),
      'where',
      plan.whereColumns.map((column, index) => `  ${quoteSqlIdentifier(column.name)} = ${column.expression}${index < plan.whereColumns.length - 1 ? ' and' : ''}`).join('\n'),
      `returning ${quotedPrimaryKeyColumn};`,
      ''
    ].join('\n');
  }

  if (plan.action === 'get-by-id') {
    return [
      'select',
      plan.resultColumns.map((column) => `  ${quoteSqlIdentifier(column.name)}`).join(',\n'),
      `from ${quotedTableName}`,
      'where',
      plan.whereColumns.map((column, index) => `  ${quoteSqlIdentifier(column.name)} = ${column.expression}${index < plan.whereColumns.length - 1 ? ' and' : ''}`).join('\n'),
      ''
    ].join('\n');
  }

  if (plan.action === 'list') {
    return [
      'select',
      plan.resultColumns.map((column) => `  ${quoteSqlIdentifier(column.name)}`).join(',\n'),
      `from ${quotedTableName}`,
      'order by',
      `  ${quotedPrimaryKeyColumn} asc`,
      'limit :limit;',
      ''
    ].join('\n');
  }

  return [
    `delete from ${quotedTableName}`,
    'where',
    plan.whereColumns.map((column, index) => `  ${quoteSqlIdentifier(column.name)} = ${column.expression}${index < plan.whereColumns.length - 1 ? ' and' : ''}`).join('\n'),
    `returning ${quotedPrimaryKeyColumn};`,
    ''
  ].join('\n');
}

function quoteQualifiedIdentifier(value: string): string {
  return value.split('.').map((segment) => quoteSqlIdentifier(segment)).join('.');
}

function quoteSqlIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toRenderField(column: ScaffoldColumnMetadata, options: { boundary: 'feature' | 'query' }): RenderField {
  const fieldName = options.boundary === 'feature' ? toCamelCase(column.name) : column.name;
  const typeName = (column.typeName ?? '').trim().toLowerCase();
  if (typeName === 'json' || typeName === 'jsonb') {
    return {
      name: fieldName,
      sourceName: column.name,
      typeScriptType: column.isNotNull ? 'Record<string, unknown>' : 'Record<string, unknown> | null',
      parserKind: 'jsonObject',
      nullable: !column.isNotNull,
      sourceType: column.typeName ?? 'jsonb'
    };
  }
  if (isBigIntLikeType(typeName)) {
    return {
      name: fieldName,
      sourceName: column.name,
      typeScriptType: column.isNotNull ? 'string' : 'string | null',
      parserKind: 'string',
      nullable: !column.isNotNull,
      sourceType: column.typeName ?? 'bigint'
    };
  }
  if (isStringEncodedNumericType(typeName)) {
    return {
      name: fieldName,
      sourceName: column.name,
      typeScriptType: column.isNotNull ? 'string' : 'string | null',
      parserKind: 'string',
      nullable: !column.isNotNull,
      sourceType: column.typeName ?? 'numeric'
    };
  }
  if (isNumberType(typeName)) {
    return {
      name: fieldName,
      sourceName: column.name,
      typeScriptType: column.isNotNull ? 'number' : 'number | null',
      parserKind: 'number',
      nullable: !column.isNotNull,
      sourceType: column.typeName ?? 'numeric'
    };
  }
  if (typeName === 'boolean' || typeName === 'bool') {
    return {
      name: fieldName,
      sourceName: column.name,
      typeScriptType: column.isNotNull ? 'boolean' : 'boolean | null',
      parserKind: 'boolean',
      nullable: !column.isNotNull,
      sourceType: column.typeName ?? 'boolean'
    };
  }
  return {
    name: fieldName,
    sourceName: column.name,
    typeScriptType: column.isNotNull ? 'string' : 'string | null',
    parserKind: 'string',
    nullable: !column.isNotNull,
    sourceType: column.typeName ?? 'text'
  };
}

function isBigIntLikeType(typeName: string): boolean {
  return [
    'bigserial',
    'serial8',
    'int8',
    'bigint'
  ].includes(typeName);
}

function isNumberType(typeName: string): boolean {
  return [
    'serial',
    'serial2',
    'serial4',
    'smallserial',
    'int',
    'int2',
    'int4',
    'integer',
    'smallint',
    'real',
    'float',
    'float4',
    'float8',
    'double precision'
  ].includes(typeName);
}

function isStringEncodedNumericType(typeName: string): boolean {
  return [
    'numeric',
    'decimal'
  ].includes(typeName);
}

function renderEntrySpecFile(params: {
  action: FeatureAction;
  featureName: string;
  pascalName: string;
  entryCamelName: string;
  queryName: string;
  queryPascalName: string;
  queryCamelName: string;
  requestFields: RenderField[];
  responseFields: RenderField[];
  insertDefaultPolicy: InsertDefaultPolicy;
}): string {
  if (params.action === 'get-by-id') {
    return renderGetByIdEntrySpecFile(params);
  }
  if (params.action === 'list') {
    return renderListEntrySpecFile(params);
  }

  const rawRequestSchema = renderZodObjectSchema('RequestSchema', params.requestFields, {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });
  const responseSchema = renderZodObjectSchema('ResponseSchema', [params.responseFields[0]], {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });
  const normalizeLines = params.requestFields.length === 0
    ? ['  return request;']
    : [
        '  return {',
        ...params.requestFields.map((field) => {
          if (field.parserKind === 'string') {
            return `    ${field.name}: request.${field.name}${field.nullable ? " === null ? null : request." + field.name + ".trim()" : '.trim()'},`;
          }
          return `    ${field.name}: request.${field.name},`;
        }),
        '  };'
      ];
  const rejectLines = params.requestFields
    .filter((field) => field.parserKind === 'string')
    .flatMap((field) => {
      const valueRef = `request.${field.name}`;
      if (field.nullable) {
        return [
          `  if (${valueRef} !== null && ${valueRef}.length === 0) {`,
          `    throw new Error('${params.pascalName}Request.${field.name} must not be empty after trim().');`,
          '  }'
        ];
      }
      return [
        `  if (${valueRef}.length === 0) {`,
        `    throw new Error('${params.pascalName}Request.${field.name} must not be empty after trim().');`,
        '  }'
      ];
    });

  return [
    "import { z } from 'zod';",
    "import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';",
    '',
    `import {`,
      `  execute${params.queryPascalName}QuerySpec,`,
    `  type ${params.queryPascalName}QueryParams,`,
    `  type ${params.queryPascalName}QueryResult`,
    `} from './queries/${params.queryName}/boundary.js';`,
    '',
    ...renderEntrySpecBoundaryComments(params.action, params.insertDefaultPolicy),
    '',
    rawRequestSchema,
    '',
    `export type ${params.pascalName}Request = z.infer<typeof RequestSchema>;`,
    '',
    responseSchema,
    '',
    `export type ${params.pascalName}Response = z.infer<typeof ResponseSchema>;`,
    '',
    '/** Parses the raw feature request at the feature boundary. */',
    `function parseRequest(raw: unknown): ${params.pascalName}Request {`,
    '  return RequestSchema.parse(raw);',
    '}',
    '',
    '/** Normalizes the parsed feature request for downstream feature logic. */',
    `function normalizeRequest(request: ${params.pascalName}Request): ${params.pascalName}Request {`,
    ...normalizeLines,
    '}',
    '',
    '/** Rejects feature requests that violate feature-level rules. */',
    `function rejectRequest(request: ${params.pascalName}Request): void {`,
    ...(rejectLines.length > 0
      ? rejectLines
      : ['  // Add feature-level reject rules here when follow-up requirements appear.']),
    '}',
    '',
    '/** Maps the feature request into query params for the query spec. */',
    `function toQueryParams(request: ${params.pascalName}Request): ${params.queryPascalName}QueryParams {`,
    ...renderTypedReturnObject(params.requestFields, `${params.queryPascalName}QueryParams`),
    '}',
    '',
    '/** Maps the query result into the feature response contract. */',
    `function fromQueryResult(result: ${params.queryPascalName}QueryResult): ${params.pascalName}Response {`,
    '  // TODO: Review domain-specific response naming before exposing this feature boundary publicly.',
    ...renderParsedObjectFromSource('result', params.responseFields, 'ResponseSchema'),
    '}',
    '',
    '/** Executes the feature boundary flow for this feature. */',
    `export async function execute${params.pascalName}EntrySpec(`,
    '  executor: FeatureQueryExecutor,',
    '  rawRequest: unknown',
    `): Promise<${params.pascalName}Response> {`,
    '  const request = normalizeRequest(parseRequest(rawRequest));',
    '  rejectRequest(request);',
    `  const result = await execute${params.queryPascalName}QuerySpec(executor, toQueryParams(request));`,
    '  return fromQueryResult(result);',
    '}',
    ''
  ].join('\n');
}

function renderEntrySpecTestFile(params: {
  featureName: string;
  queryName: string;
  pascalName: string;
  hasRequestFields: boolean;
}): string {
  const entrypointImportPath = '../boundary.js';
  const sharedExecutorImportPath = '../../_shared/featureQueryExecutor.js';

  if (!params.hasRequestFields) {
    return [
      "import { test } from 'vitest';",
      '',
      `test.todo('cover feature boundary behavior for ${params.featureName}/${params.queryName}');`,
      `test.todo('cover normalization and response mapping for ${params.pascalName} boundary');`,
      '',
      '// AI follow-up note:',
      `// Keep the real assertions in this file if the feature boundary needs more than mock-based boundary checks.`,
      `// The query-boundary contract lives in queries/${params.queryName}/tests/${params.queryName}.boundary.ztd.test.ts.`,
      ''
    ].join('\n');
  }

  return [
    "import { expect, test } from 'vitest';",
    '',
    `import { execute${params.pascalName}EntrySpec } from '${entrypointImportPath}';`,
    `import type { FeatureQueryExecutor } from '${sharedExecutorImportPath}';`,
    '',
    'function createGuardedExecutor(): FeatureQueryExecutor {',
    '  return {',
    '    async query() {',
    `      throw new Error('Feature boundary tests stay mock-based for ${params.featureName}; keep DB-backed execution in the boundary lane.');`,
    '    }',
    '  };',
    '}',
    '',
    `test('rejects invalid feature input at the feature boundary for ${params.featureName}/${params.queryName}', async () => {`,
    `  await expect(execute${params.pascalName}EntrySpec(createGuardedExecutor(), {})).rejects.toThrow();`,
    '});',
    '',
    `test.todo('cover normalization and response mapping for ${params.pascalName} boundary');`,
    '',
    '// AI follow-up note:',
    `// Keep the real assertions in this file if the feature boundary needs more than mock-based boundary checks.`,
    `// The query-boundary contract lives in queries/${params.queryName}/tests/${params.queryName}.boundary.ztd.test.ts.`,
    ''
  ].join('\n');
}

function renderQuerySpecFile(params: {
  action: FeatureAction;
  queryName: string;
  boundaryRelativeDir: string;
  queryPascalName: string;
  queryCamelName: string;
  requestFields: RenderField[];
  responseFields: RenderField[];
  sharedExecutorImportPath: string;
  sharedLoadSqlResourceImportPath: string;
  insertDefaultPolicy: InsertDefaultPolicy;
}): string {
  if (params.action === 'get-by-id') {
    return renderGetByIdQuerySpecFile(params);
  }
  if (params.action === 'list') {
    return renderListQuerySpecFile(params);
  }

  const paramsSchema = renderZodObjectSchema('QueryParamsSchema', params.requestFields, {
    trimStrings: false,
    rejectEmptyStrings: true,
    exported: false,
    strict: true
  });
  const rowSchema = renderZodObjectSchema('RowSchema', [params.responseFields[0]], {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });
  const resultSchema = renderZodObjectSchema('QueryResultSchema', [params.responseFields[0]], {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });

  return [
    "import { z } from 'zod';",
    "import { dirname } from 'node:path';",
    "import { fileURLToPath } from 'node:url';",
    '',
    `import type { FeatureQueryExecutor } from '${params.sharedExecutorImportPath}';`,
    `import { loadSqlResource } from '${params.sharedLoadSqlResourceImportPath}';`,
    `import { map${params.queryPascalName}RowToResult } from './generated/row-mapper.js';`,
    '',
    'const __dirname = dirname(fileURLToPath(import.meta.url));',
    `const ${params.queryCamelName}SqlResource = loadSqlResource(__dirname, '${params.queryName}.sql');`,
    '',
    ...renderQuerySpecBoundaryComments(params.action, params.insertDefaultPolicy),
    paramsSchema,
    '',
    `export type ${params.queryPascalName}QueryParams = z.infer<typeof QueryParamsSchema>;`,
    '',
    rowSchema,
    '',
    resultSchema,
    '',
    `export type ${params.queryPascalName}QueryResult = z.infer<typeof QueryResultSchema>;`,
    '',
    `export type ${params.queryPascalName}Row = z.infer<typeof RowSchema>;`,
    '',
    '/** Parses raw query params at the query boundary. */',
    `function parseQueryParams(raw: unknown): ${params.queryPascalName}QueryParams {`,
    '  return QueryParamsSchema.parse(raw);',
    '}',
    '',
    '/** Parses a raw DB row at the query boundary. */',
    `function parseRow(raw: unknown): ${params.queryPascalName}Row {`,
    '  return RowSchema.parse(raw);',
    '}',
    '',
    '/** Loads the single row for the write baseline. */',
    `async function loadSingleRow(executor: FeatureQueryExecutor, sql: string, params: Record<string, unknown>): Promise<${params.queryPascalName}Row> {`,
    '  const rows = await executor.query<Record<string, unknown>>(sql, params);',
    '  if (rows.length !== 1) {',
    `    throw new Error('${params.queryPascalName}QuerySpec expected exactly one row.');`,
    '  }',
    '  return parseRow(rows[0]);',
    '}',
    '',
    '/** Executes the query boundary flow for this query spec. */',
    `export async function execute${params.queryPascalName}QuerySpec(`,
    `  executor: FeatureQueryExecutor,`,
    `  rawParams: unknown`,
    `): Promise<${params.queryPascalName}QueryResult> {`,
    '  const params = parseQueryParams(rawParams);',
    `  const row = await loadSingleRow(executor, ${params.queryCamelName}SqlResource, params);`,
    `  return map${params.queryPascalName}RowToResult(row);`,
    '}',
    ''
  ].join('\n');
}

function renderReadmeFile(params: {
  action: FeatureAction;
  featureName: string;
  queryName: string;
  tableName: string;
  primaryKeyColumn: string;
  generatedColumns: string[];
  queryColumns: string[];
  parameterColumns: string[];
  defaultExpressionColumns: string[];
  omittedDefaultColumns: string[];
  insertDefaultPolicy: InsertDefaultPolicy;
}): string {
  const generatedColumnsLine = params.action === 'insert'
    ? params.generatedColumns.length > 0
      ? `- Generated / identity / sequence-backed columns excluded at scaffold time: ${params.generatedColumns.map((name) => `\`${name}\``).join(', ')}.`
      : '- No generated / identity / sequence-backed columns were detected for exclusion in this scaffold.'
    : params.action === 'get-by-id' || params.action === 'list'
      ? '- Generated / identity handling is unchanged in this read scaffold because the baseline only reads the selected row shape.'
      : '- Generated / identity handling remains explicit in this write scaffold; no extra generated-column behavior is inferred here.';
  const queryColumnsLine = params.queryColumns.length > 0
    ? `- Initial ${params.action} query columns: ${params.queryColumns.map((name) => `\`${name}\``).join(', ')}.`
    : `- Initial ${params.action} query does not require caller-visible write columns.`;
  const parameterColumnsLine = params.parameterColumns.length > 0
    ? `- Caller-supplied request/query params: ${params.parameterColumns.map((name) => `\`${name}\``).join(', ')}.`
    : '- The baseline keeps caller-supplied request/query params empty until the use case requires explicit inputs.';
  const defaultExpressionColumnsLine = params.action === 'insert' && params.defaultExpressionColumns.length > 0
    ? `- DDL-backed default expressions written directly into SQL: ${params.defaultExpressionColumns.map((name) => `\`${name}\``).join(', ')}.`
    : params.action === 'insert'
      ? params.insertDefaultPolicy === 'omit-db-defaults' && params.omittedDefaultColumns.length > 0
        ? `- DB-default columns omitted from INSERT so the database assigns them: ${params.omittedDefaultColumns.map((name) => `\`${name}\``).join(', ')}.`
        : '- No general insert columns used DDL-backed default expressions in this scaffold.'
      : params.action === 'get-by-id' || params.action === 'list'
        ? '- Read baselines do not infer additional filter or default-expression policy beyond the explicit SQL and spec contract.'
        : '- Write baselines do not infer additional default-expression or policy behavior beyond the explicit SQL and spec contract.';
  const insertDefaultPolicyLines = params.action === 'insert'
    ? [
      `- INSERT default-column policy: \`${params.insertDefaultPolicy}\`.`,
      params.insertDefaultPolicy === 'explicit-defaults'
        ? '- `explicit-defaults` copies DDL default expressions into SQL so reviewers can see the exact assigned value in the generated query.'
        : '- `omit-db-defaults` leaves DB-default columns out of the INSERT column list so the database assigns them at execution time.',
      '- TODO: Review this default-column policy before treating the scaffold as business-safe; choose `explicit-defaults` when the SQL must show the assignment, and `omit-db-defaults` when the database default is the intended runtime behavior.'
    ]
    : [];

  return [
    `# ${params.featureName}`,
    '',
    '## Purpose',
    '',
    `Scaffold a minimal ${params.action} feature skeleton for \`${params.tableName}\` with explicit feature, DB, and transport boundaries.`,
    '',
    '## Fixed feature layout contract',
    '',
    '```text',
    FIXED_LAYOUT_DESCRIPTION,
    '```',
    '',
    '## CLI-created files',
    '',
    '- `boundary.ts`',
    `- \`tests/${params.featureName}.boundary.test.ts\``,
    `- \`queries/${params.queryName}/boundary.ts\``,
    `- \`queries/${params.queryName}/${params.queryName}.sql\``,
    `- \`queries/${params.queryName}/generated/row-mapper.ts\``,
    '- `README.md`',
    '',
    '## Shared helper files created by the CLI when missing',
    '',
    '- `src/features/_shared/featureQueryExecutor.ts`',
    '- `src/features/_shared/loadSqlResource.ts`',
    '- Catalog runtime primitives from `@rawsql-ts/sql-contract`',
    '',
    '## CLI-owned generated files',
    '',
    `- \`queries/${params.queryName}/generated/row-mapper.ts\``,
    `- \`generated/*\` is CLI-owned, machine-owned, and refreshable. If deleted or drifted, run \`ztd feature generated-mapper generate --feature ${params.featureName} --query ${params.queryName}\` to recreate it.`,
    `- CI/test should run \`ztd feature generated-mapper check --feature ${params.featureName}\` so contract drift fails with a regeneration command instead of depending on voluntary cleanup.`,
    '',
    '## Created by `feature tests scaffold` after SQL and DTO edits',
    '',
    `- \`queries/${params.queryName}/tests/boundary-ztd-types.ts\``,
    `- \`queries/${params.queryName}/tests/generated/TEST_PLAN.md\``,
    `- \`queries/${params.queryName}/tests/generated/analysis.json\``,
    `- \`queries/${params.queryName}/tests/${params.queryName}.boundary.ztd.test.ts\``,
    '',
    '## Human/AI-owned persistent files',
    '',
    `- persistent case files under \`queries/${params.queryName}/tests/cases/\``,
    `- cases/* is human/AI-owned and kept.`,
    `- \`queries/${params.queryName}/tests/${params.queryName}.boundary.ztd.test.ts\` is a thin Vitest entrypoint and is kept.`,
    '',
    '## RFBA review responsibilities',
    '',
    '- RFBA splits files by review responsibility; this scaffold keeps review-heavy SQL visible and keeps DTO/mapping/test support close to the SQL it serves.',
    '- `boundary.ts` is the default feature-boundary public surface for request parsing, normalization, rejection, query-parameter assembly, and response shaping.',
    ...renderReadmeEntryspecNotes(params.action, params.parameterColumns),
    '- `boundary.ts` keeps its schema values and helper functions file-local; it converts request data to query params explicitly and depends on the shared executor contract directly.',
    `- \`queries/${params.queryName}/\` is the query unit: SQL, generated row/result mapping, execution contract, and query-local tests move together for review.`,
    `- \`queries/${params.queryName}/boundary.ts\` is the default query-boundary public surface for query params, row shape, query result shape, and SQL execution contract.`,
    `- \`queries/${params.queryName}/boundary.ts\` keeps public flow thin while generated row mapping stays under \`queries/${params.queryName}/generated/\`.`,
    `- \`queries/${params.queryName}/boundary.ts\` and \`queries/${params.queryName}/${params.queryName}.sql\` stay co-located as one boundary/SQL pair.`,
    `- \`tests/${params.featureName}.boundary.test.ts\` is the thin Vitest entrypoint for the feature boundary lane.`,
    '- Feature-boundary tests mock child query boundaries and verify feature validation, mapping, and orchestration.',
    '- Query-boundary tests own SQL behavior through ZTD or another SQL-specific lane.',
    '- Integration tests are opt-in and should be named as integration tests when they intentionally cross multiple live boundaries.',
    '- Use `src/libraries/` only for driver-neutral code reusable enough to stand as an external package; keep feature-specific validation and helpers inside the owning feature.',
    `- \`queries/${params.queryName}/tests/${params.queryName}.boundary.ztd.test.ts\` is the thin Vitest entrypoint for the ZTD query lane.`,
    generatedColumnsLine,
    queryColumnsLine,
    parameterColumnsLine,
    defaultExpressionColumnsLine,
    ...insertDefaultPolicyLines,
    ...renderReadmeOperationNotes(params.action, params.primaryKeyColumn, params.insertDefaultPolicy),
    '',
    '## Follow-up query growth',
    '',
    `- Keep this baseline as one workflow and one primary query by default; add another sibling query directory under \`queries/\` only if a follow-up intentionally expands the feature.`,
    '- If a follow-up adds another query directory, keep each query directory self-contained around its public entrypoint and SQL resource.',
    '- Add transport-specific adapters later only when a concrete transport contract exists.',
    '',
    '## Shared helper note',
    '',
    '- `src/features/_shared/featureQueryExecutor.ts` is the shared runtime contract for DB execution injection.',
    '- Cardinality and catalog execution should come from `@rawsql-ts/sql-contract` so the scaffold does not re-invent feature-local helpers.',
    '- Treat `exactly-one`, `zero-or-one`, `many`, and `scalar` as the long-term cardinality contract family for future CRUD and SELECT expansion.',
    '',
    '## Follow-up customization points',
    '',
    '- Narrow field types and validation rules once the transport contract is known.',
    '- Replace any scaffolded DDL-backed default expression if the feature needs a different explicit SQL assignment.',
    ...renderReadmeFollowUpNotes(params.action),
    `- After the SQL and DTO edits settle, run \`ztd feature tests scaffold --feature ${params.featureName}\` to refresh the CLI-owned generated files, keep the thin Vitest entrypoint in place, and then keep the persistent case files as human/AI-owned query-local assets.`,
    ''
  ].join('\n');
}

function renderReadmeEntryspecNotes(action: FeatureAction, parameterColumns: string[]): string[] {
  if (action === 'get-by-id') {
    return [
      '- `boundary.ts` uses `zod` schemas for request and response DTOs and keeps the get-by-id baseline focused on key-only request parsing.',
      '- `boundary.ts` rejects unsupported request fields instead of silently ignoring them in the baseline scaffold.',
      '- The get-by-id baseline keeps not-found handling explicit and non-throwing so follow-up work can decide whether to keep nullable output or move to an exactly-one contract.'
    ];
  }
  if (action === 'list') {
    return [
      '- `boundary.ts` uses `zod` schemas for request and response DTOs, keeps the baseline request minimal, and returns a `{ items: [...] }` response contract.',
      '- `boundary.ts` rejects unsupported request fields instead of silently ignoring them in the baseline scaffold.',
      '- `boundary.ts` does not expose explicit paging inputs in the baseline scaffold; follow-up work can add them once the use case is known.'
    ];
  }
  const hasStringLikeInput = parameterColumns.length > 0;
  if (action === 'delete') {
    return [
      '- `boundary.ts` uses `zod` schemas for request and response DTOs and keeps the delete baseline focused on key-only request parsing.',
      '- The delete baseline does not assume string normalization; add transport-specific parsing or policy checks later only when the feature actually needs them.'
    ];
  }

  if (hasStringLikeInput) {
    return [
      '- `boundary.ts` uses `zod` schemas for request and response DTOs, and the scaffold includes `trim()` plus empty-string rejection examples for current string inputs.'
    ];
  }

  return [
    '- `boundary.ts` uses `zod` schemas for request and response DTOs and leaves string normalization examples for follow-up when string fields appear.'
  ];
}

function renderEntrySpecBoundaryComments(
  action: FeatureAction,
  insertDefaultPolicy: InsertDefaultPolicy = DEFAULT_INSERT_DEFAULT_POLICY
): string[] {
  if (action === 'get-by-id') {
    return [
      '// The get-by-id baseline accepts only the primary-key request input.',
      '// Keep not-found handling explicit here instead of promoting it to an exception contract by default.'
    ];
  }
  if (action === 'list') {
    return [
      '// The list baseline keeps the request contract intentionally minimal.',
      '// Paging and stable ordering stay inside queries/<query>/boundary.ts so the feature boundary remains transport-focused.'
    ];
  }
  if (action === 'insert') {
    return [
      '// Only non-default insert columns remain in the initial feature request.',
      insertDefaultPolicy === 'explicit-defaults'
        ? '// DDL-backed default expressions are written into the SQL resource explicitly.'
        : '// DB-default insert columns are omitted from the SQL resource so the database assigns them.'
    ];
  }
  if (action === 'update') {
    return [
      '// The initial update request carries the primary key plus every mechanically mutable candidate column.',
      '// Treat control or audit fields as follow-up review points; remove or pin them when the feature contract becomes more specific.'
    ];
  }
  return [
    '// The initial delete request carries only the primary-key predicate.',
    '// Add richer policy or authorization checks here as follow-up requirements appear.'
  ];
}

function renderQuerySpecBoundaryComments(
  action: FeatureAction,
  insertDefaultPolicy: InsertDefaultPolicy = DEFAULT_INSERT_DEFAULT_POLICY
): string[] {
  if (action === 'get-by-id') {
    return [
      '// Query params own only the primary-key predicate for the get-by-id baseline.',
      '// The baseline query returns zero or one row and leaves not-found handling non-throwing.'
    ];
  }
  if (action === 'list') {
    return [
      '// queries/<query>/boundary.ts owns the list baseline paging and primary-key ordering contract.',
      '// Keep the request contract narrow here; explicit paging inputs can be added later when the use case is known.'
    ];
  }
  if (action === 'insert') {
    return [
      '// Query params own only the DB-boundary values that still need caller-supplied input.',
      insertDefaultPolicy === 'explicit-defaults'
        ? '// DDL-backed defaults are reflected directly in the SQL resource.'
        : '// DB-default columns are omitted from the INSERT column list.'
    ];
  }
  if (action === 'update') {
    return [
      '// Query params own the primary-key predicate plus every caller-supplied write value.',
      '// The baseline update query returns the primary key after exactly one-row execution.'
    ];
  }
  return [
    '// Query params own only the primary-key predicate for the delete baseline.',
    '// The baseline delete query returns the primary key after exactly one-row execution.'
  ];
}

function renderReadmeOperationNotes(
  action: FeatureAction,
  primaryKeyColumn: string,
  insertDefaultPolicy: InsertDefaultPolicy
): string[] {
  if (action === 'get-by-id') {
    return [
      `- The baseline get-by-id query uses \`${primaryKeyColumn}\` as the predicate and selects the scaffolded row shape explicitly.`,
      '- The baseline allows not found instead of treating it as an exception.',
      '- Generated request and response contracts follow the DDL-derived column types for this feature; the scaffold does not assume that every ID is a 32-bit integer.',
      '- If the feature later needs a strict existence guarantee, this scaffold can be tightened to a strict one-row contract as a follow-up decision.'
    ];
  }
  if (action === 'list') {
    return [
      `- The baseline list query applies stable primary-key ordering by \`${primaryKeyColumn}\` and keeps paging enabled by default.`,
      `- \`DEFAULT_PAGE_SIZE\` is set to \`${DEFAULT_PAGE_SIZE}\` in queries/<query>/boundary.ts so the default can be changed without widening the request contract first.`,
      '- Generated request and response contracts follow the DDL-derived column types for this feature; the scaffold does not assume that every ID is a 32-bit integer.',
      '- The baseline response is `{ items: [...] }` so paging metadata and other list-level fields can be added later without breaking the response shape.'
    ];
  }
  if (action === 'insert') {
    return [
      insertDefaultPolicy === 'explicit-defaults'
        ? '- SQL omits only generated / identity / sequence-backed primary keys. Every other insert column stays explicit in the scaffold SQL.'
        : '- SQL omits generated / identity / sequence-backed primary keys and DB-default columns selected by the scaffold policy.',
      insertDefaultPolicy === 'explicit-defaults'
        ? '- When DDL declares a column default, the scaffold writes that default expression into SQL explicitly instead of relying on an implicit database default at runtime.'
        : '- When DDL declares a column default, the scaffold omits that column so the database default applies at runtime.',
      `- The insert result returns the primary key only: \`${primaryKeyColumn}\`.`
    ];
  }
  if (action === 'update') {
    return [
      `- The baseline update query uses \`${primaryKeyColumn}\` as the predicate and updates every non-generated, non-primary-key column explicitly.`,
      '- This baseline is mechanical, not a mutable-policy guarantee. Control or audit columns such as `created_at`, `updated_at`, and similar fields are representative follow-up candidates to remove, pin, or otherwise specialize.',
      `- The update result returns the primary key only: \`${primaryKeyColumn}\`.`
    ];
  }
  return [
    `- The baseline delete query uses \`${primaryKeyColumn}\` as the predicate and performs a primary-key-only delete.`,
    `- The delete result returns the primary key only: \`${primaryKeyColumn}\`.`
  ];
}

function renderReadmeFollowUpNotes(action: FeatureAction): string[] {
  if (action === 'get-by-id') {
    return [
      '- Switch to a strict one-row contract later only if the feature decides that missing rows must fail instead of returning a nullable result.'
    ];
  }
  if (action === 'list') {
    return [
      '- Add explicit paging inputs, filter fields, or richer ordering only after the list use case is known.',
      '- Keep catalog-based paging and ordering inside `queries/<query>/boundary.ts` as the feature grows.'
    ];
  }
  if (action === 'update') {
    return [
      '- Revisit the mutable field set before treating the scaffold as business-safe. Control and audit columns are expected follow-up review points for update features.'
    ];
  }

  if (action === 'delete') {
    return [
      '- Add richer delete policy, authorization checks, or soft-delete behavior later if the feature contract requires them.'
    ];
  }

  return [];
}

function renderGetByIdEntrySpecFile(params: {
  action: FeatureAction;
  featureName: string;
  pascalName: string;
  entryCamelName: string;
  queryName: string;
  queryPascalName: string;
  queryCamelName: string;
  requestFields: RenderField[];
  responseFields: RenderField[];
}): string {
  const rawRequestSchema = renderZodObjectSchema('RequestSchema', params.requestFields, {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });
  const responseRowSchema = renderZodObjectSchema('ResponseRowSchema', params.responseFields, {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });

  return [
    "import { z } from 'zod';",
    "import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';",
    '',
    `import {`,
    `  execute${params.queryPascalName}QuerySpec,`,
    `  type ${params.queryPascalName}QueryParams,`,
    `  type ${params.queryPascalName}QueryResult`,
    `} from './queries/${params.queryName}/boundary.js';`,
    '',
    ...renderEntrySpecBoundaryComments(params.action),
    '',
    rawRequestSchema,
    '',
    `export type ${params.pascalName}Request = z.infer<typeof RequestSchema>;`,
    '',
    responseRowSchema,
    '',
    'const ResponseSchema = ResponseRowSchema.nullable();',
    '',
    `export type ${params.pascalName}Response = z.infer<typeof ResponseSchema>;`,
    '',
    '/** Parses the raw feature request at the feature boundary. */',
    `function parseRequest(raw: unknown): ${params.pascalName}Request {`,
    `  return RequestSchema.parse(raw);`,
    '}',
    '',
    '/** Normalizes the parsed feature request for downstream feature logic. */',
    `function normalizeRequest(request: ${params.pascalName}Request): ${params.pascalName}Request {`,
    '  return {',
    ...params.requestFields.map((field) => field.parserKind === 'string'
      ? `    ${field.name}: request.${field.name}.trim(),`
      : `    ${field.name}: request.${field.name},`),
    '  };',
    '}',
    '',
    '/** Rejects feature requests that violate feature-level rules. */',
    `function rejectRequest(request: ${params.pascalName}Request): void {`,
    ...params.requestFields
      .filter((field) => field.parserKind === 'string')
      .flatMap((field) => [
        `  if (request.${field.name}.length === 0) {`,
        `    throw new Error('${params.pascalName}Request.${field.name} must not be empty after trim().');`,
        '  }'
      ]),
    ...(params.requestFields.some((field) => field.parserKind === 'string')
      ? []
      : ['  // Add feature-level reject rules here when follow-up requirements appear.']),
    '}',
    '',
    '/** Maps the feature request into query params for the query spec. */',
    `function toQueryParams(request: ${params.pascalName}Request): ${params.queryPascalName}QueryParams {`,
    ...renderTypedReturnObject(params.requestFields, `${params.queryPascalName}QueryParams`),
    '}',
    '',
    '/** Maps the query result into the feature response contract. */',
    `function fromQueryResult(result: ${params.queryPascalName}QueryResult): ${params.pascalName}Response {`,
    '  if (result === null) {',
    '    return null;',
    '  }',
    '  // TODO: Review domain-specific response naming before exposing this feature boundary publicly.',
    ...renderParsedObjectFromSource('result', params.responseFields, 'ResponseSchema'),
    '}',
    '',
    '/** Executes the feature boundary flow for this feature. */',
    `export async function execute${params.pascalName}EntrySpec(`,
    '  executor: FeatureQueryExecutor,',
    '  rawRequest: unknown',
    `): Promise<${params.pascalName}Response> {`,
    '  const request = normalizeRequest(parseRequest(rawRequest));',
    '  rejectRequest(request);',
    `  const result = await execute${params.queryPascalName}QuerySpec(executor, toQueryParams(request));`,
    '  return fromQueryResult(result);',
    '}',
    ''
  ].join('\n');
}

function renderListEntrySpecFile(params: {
  action: FeatureAction;
  featureName: string;
  pascalName: string;
  entryCamelName: string;
  queryName: string;
  queryPascalName: string;
  queryCamelName: string;
  requestFields: RenderField[];
  responseFields: RenderField[];
}): string {
  const rawRequestSchema = renderZodObjectSchema('RequestSchema', params.requestFields, {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });
  const responseItemSchema = renderZodObjectSchema('ResponseItemSchema', params.responseFields, {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });

  return [
    "import { z } from 'zod';",
    "import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';",
    '',
    `import {`,
    `  execute${params.queryPascalName}QuerySpec,`,
    `  type ${params.queryPascalName}QueryParams,`,
    `  type ${params.queryPascalName}QueryResult`,
    `} from './queries/${params.queryName}/boundary.js';`,
    '',
    ...renderEntrySpecBoundaryComments(params.action),
    '',
    rawRequestSchema,
    '',
    `export type ${params.pascalName}Request = z.infer<typeof RequestSchema>;`,
    '',
    responseItemSchema,
    '',
    'const ResponseSchema = z.object({',
    '  items: z.array(ResponseItemSchema),',
    '}).strict();',
    '',
    `export type ${params.pascalName}Response = z.infer<typeof ResponseSchema>;`,
    '',
    '/** Parses the raw feature request at the feature boundary. */',
    `function parseRequest(raw: unknown): ${params.pascalName}Request {`,
    '  return RequestSchema.parse(raw);',
    '}',
    '',
    '/** Normalizes the parsed feature request for downstream feature logic. */',
    `function normalizeRequest(request: ${params.pascalName}Request): ${params.pascalName}Request {`,
    '  return request;',
    '}',
    '',
    '/** Rejects feature requests that violate feature-level rules. */',
    `function rejectRequest(_request: ${params.pascalName}Request): void {`,
    '  // Add feature-level reject rules here when follow-up requirements appear.',
    '}',
    '',
    '/** Maps the feature request into query params for the query spec. */',
    `function toQueryParams(_request: ${params.pascalName}Request): ${params.queryPascalName}QueryParams {`,
    `  return {} as ${params.queryPascalName}QueryParams;`,
    '}',
    '',
    '/** Maps the query result into the feature response contract. */',
    `function fromQueryResult(result: ${params.queryPascalName}QueryResult): ${params.pascalName}Response {`,
    '  // TODO: Review domain-specific response naming before exposing this feature boundary publicly.',
    '  return ResponseSchema.parse({',
    '    items: result.items.map((item) => ({',
    ...params.responseFields.map((field) => `      ${field.name}: item.${field.sourceName},`),
    '    })),',
    '  });',
    '}',
    '',
    '/** Executes the feature boundary flow for this feature. */',
    `export async function execute${params.pascalName}EntrySpec(`,
    '  executor: FeatureQueryExecutor,',
    '  rawRequest: unknown',
    `): Promise<${params.pascalName}Response> {`,
    '  const request = normalizeRequest(parseRequest(rawRequest));',
    '  rejectRequest(request);',
    `  const result = await execute${params.queryPascalName}QuerySpec(executor, toQueryParams(request));`,
    '  return fromQueryResult(result);',
    '}',
    ''
  ].join('\n');
}

function renderGetByIdQuerySpecFile(params: {
  action: FeatureAction;
  queryName: string;
  boundaryRelativeDir: string;
  queryPascalName: string;
  queryCamelName: string;
  requestFields: RenderField[];
  responseFields: RenderField[];
  sharedExecutorImportPath: string;
  sharedLoadSqlResourceImportPath: string;
}): string {
  const paramsSchema = renderZodObjectSchema('QueryParamsSchema', params.requestFields, {
    trimStrings: false,
    rejectEmptyStrings: true,
    exported: false,
    strict: true
  });
  const rowSchema = renderZodObjectSchema('RowSchema', params.responseFields, {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });

  return [
    "import { z } from 'zod';",
    "import { dirname } from 'node:path';",
    "import { fileURLToPath } from 'node:url';",
    '',
    `import type { FeatureQueryExecutor } from '${params.sharedExecutorImportPath}';`,
    `import { loadSqlResource } from '${params.sharedLoadSqlResourceImportPath}';`,
    `import { map${params.queryPascalName}RowToResult } from './generated/row-mapper.js';`,
    '',
    'const __dirname = dirname(fileURLToPath(import.meta.url));',
    `const ${params.queryCamelName}SqlResource = loadSqlResource(__dirname, '${params.queryName}.sql');`,
    '',
    ...renderQuerySpecBoundaryComments(params.action),
    paramsSchema,
    '',
    `export type ${params.queryPascalName}QueryParams = z.infer<typeof QueryParamsSchema>;`,
    '',
    rowSchema,
    '',
    'const QueryResultSchema = RowSchema.nullable();',
    '',
    `export type ${params.queryPascalName}QueryResult = z.infer<typeof QueryResultSchema>;`,
    '',
    `export type ${params.queryPascalName}Row = z.infer<typeof RowSchema>;`,
    '',
    '/** Parses raw query params at the query boundary. */',
    `function parseQueryParams(raw: unknown): ${params.queryPascalName}QueryParams {`,
    `  return QueryParamsSchema.parse(raw);`,
    '}',
    '',
    '/** Parses a raw DB row at the query boundary. */',
    `function parseRow(raw: unknown): ${params.queryPascalName}Row {`,
    `  return RowSchema.parse(raw);`,
    '}',
    '',
    '/** Loads the optional row for the get-by-id baseline. */',
    `async function loadOptionalRow(executor: FeatureQueryExecutor, sql: string, params: Record<string, unknown>): Promise<${params.queryPascalName}Row | undefined> {`,
    '  const rows = await executor.query<Record<string, unknown>>(sql, params);',
    '  if (rows.length === 0) {',
    '    return undefined;',
    '  }',
    '  if (rows.length > 1) {',
    `    throw new Error('${params.queryPascalName}QuerySpec expected at most one row.');`,
    '  }',
    '  return parseRow(rows[0]);',
    '}',
    '',
    '/** Executes the query boundary flow for this query spec. */',
    `export async function execute${params.queryPascalName}QuerySpec(`,
    '  executor: FeatureQueryExecutor,',
    '  rawParams: unknown',
    `): Promise<${params.queryPascalName}QueryResult> {`,
    '  const params = parseQueryParams(rawParams);',
    `  const row = await loadOptionalRow(executor, ${params.queryCamelName}SqlResource, params);`,
    `  return map${params.queryPascalName}RowToResult(row);`,
    '}',
    ''
  ].join('\n');
}

function renderListQuerySpecFile(params: {
  action: FeatureAction;
  queryName: string;
  boundaryRelativeDir: string;
  queryPascalName: string;
  queryCamelName: string;
  requestFields: RenderField[];
  responseFields: RenderField[];
  sharedExecutorImportPath: string;
  sharedLoadSqlResourceImportPath: string;
}): string {
  const paramsSchema = renderZodObjectSchema('QueryParamsSchema', params.requestFields, {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });
  const rowSchema = renderZodObjectSchema('RowSchema', params.responseFields, {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false,
    strict: true
  });

  return [
    "import { z } from 'zod';",
    "import { dirname } from 'node:path';",
    "import { fileURLToPath } from 'node:url';",
    '',
    `import type { FeatureQueryExecutor } from '${params.sharedExecutorImportPath}';`,
    "import { createCatalogExecutor, type QuerySpec } from '@rawsql-ts/sql-contract';",
    `import { loadSqlResource } from '${params.sharedLoadSqlResourceImportPath}';`,
    `import { map${params.queryPascalName}RowsToResult } from './generated/row-mapper.js';`,
    '',
    `const DEFAULT_PAGE_SIZE = ${DEFAULT_PAGE_SIZE};`,
    'const __dirname = dirname(fileURLToPath(import.meta.url));',
    `const ${params.queryCamelName}SqlResource = loadSqlResource(__dirname, '${params.queryName}.sql');`,
    '',
    ...renderQuerySpecBoundaryComments(params.action),
    paramsSchema,
    '',
    `export type ${params.queryPascalName}QueryParams = z.infer<typeof QueryParamsSchema>;`,
    '',
    rowSchema,
    '',
    'const QueryResultSchema = z.object({',
    '  items: z.array(RowSchema),',
    '}).strict();',
    '',
    `export type ${params.queryPascalName}QueryResult = z.infer<typeof QueryResultSchema>;`,
    '',
    `export type ${params.queryPascalName}Row = z.infer<typeof RowSchema>;`,
    `type ${params.queryPascalName}CatalogQueryParams = ${params.queryPascalName}QueryParams & {`,
    '  limit: number;',
    '};',
    '',
    '/** Parses raw query params at the query boundary. */',
    `function parseQueryParams(raw: unknown): ${params.queryPascalName}QueryParams {`,
    '  return QueryParamsSchema.parse(raw);',
    '}',
    '',
    '/** Parses a raw DB row at the query boundary. */',
    `function parseRow(raw: unknown): ${params.queryPascalName}Row {`,
    '  return RowSchema.parse(raw);',
    '}',
    '',
    `const ${params.queryCamelName}CatalogSpec: QuerySpec<${params.queryPascalName}CatalogQueryParams, ${params.queryPascalName}Row> = {`,
    `  id: '${params.boundaryRelativeDir}/queries/${params.queryName}/spec',`,
    `  sqlFile: '${params.boundaryRelativeDir}/queries/${params.queryName}/${params.queryName}.sql',`,
    '  params: {',
    "    shape: 'named',",
    '    example: {',
    '      limit: DEFAULT_PAGE_SIZE,',
    `    } as ${params.queryPascalName}CatalogQueryParams,`,
    '  },',
    '  output: {',
    '    validate: (row) => parseRow(row),',
    '    example: RowSchema.parse({',
    ...params.responseFields.map((field) => `      ${field.name}: ${renderExampleValue(field)},`),
    '    }),',
    '  },',
    '};',
    '',
    '/** Maps the feature request into query params for the query spec. */',
    `function toQueryParams(params: ${params.queryPascalName}QueryParams): ${params.queryPascalName}CatalogQueryParams {`,
    '  return {',
    '    ...params,',
    '    limit: DEFAULT_PAGE_SIZE,',
    '  };',
    '}',
    '',
    '/** Executes the query boundary flow for this query spec. */',
    `export async function execute${params.queryPascalName}QuerySpec(`,
    '  executor: FeatureQueryExecutor,',
    '  rawParams: unknown',
    `): Promise<${params.queryPascalName}QueryResult> {`,
    '  const params = parseQueryParams(rawParams);',
    '  const catalog = createCatalogExecutor({',
    '    loader: {',
    `      load: async () => ${params.queryCamelName}SqlResource,`,
    '    },',
    '    executor: (sql, queryParams) => executor.query<Record<string, unknown>>(sql, queryParams as Record<string, unknown>),',
    '    allowNamedParamsWithoutBinder: true,',
    '  });',
    `  const rows = await catalog.list(${params.queryCamelName}CatalogSpec, toQueryParams(params));`,
    `  return map${params.queryPascalName}RowsToResult(rows);`,
    '}',
    ''
  ].join('\n');
}

function renderGeneratedRowMapperFile(params: {
  action: FeatureAction;
  queryPascalName: string;
  responseFields: RenderField[];
  boundarySource: string;
  sqlSource: string;
}): string {
  if (params.responseFields.length === 0) {
    throw new Error(`Cannot generate row mapper for ${params.queryPascalName}: no result fields were available.`);
  }
  return renderGeneratedRowMapperFileFromSpec({
    queryPascalName: params.queryPascalName,
    mode: params.action === 'list' ? 'list' : params.action === 'get-by-id' ? 'optional' : 'single',
    fieldNames: params.responseFields.map((field) => field.name),
    hasMany: undefined,
    boundaryHash: hashGeneratedMapperSource(params.boundarySource),
    sqlHash: hashGeneratedMapperSource(params.sqlSource)
  });
}

function renderGeneratedRowMapperFileFromSpec(params: {
  queryPascalName: string;
  mode: GeneratedMapperMode;
  fieldNames: string[];
  hasMany?: GeneratedHasManyRelationMetadata;
  boundaryHash: string;
  sqlHash: string;
}): string {
  if (params.fieldNames.length === 0) {
    throw new Error(`Cannot generate row mapper for ${params.queryPascalName}: no result fields were available.`);
  }
  const header = [
    '// @generated by rawsql-ts ztd-cli. Do not edit.',
    '// This file is machine-owned and regenerated by `ztd feature generated-mapper generate`.',
    `// source-boundary-sha256: ${params.boundaryHash}`,
    `// source-sql-sha256: ${params.sqlHash}`,
    ''
  ];
  const importLine = `import type { ${params.queryPascalName}QueryResult, ${params.queryPascalName}Row } from '../boundary.js';`;
  if (params.mode === 'hasMany') {
    if (!params.hasMany) {
      throw new Error(`Cannot generate hasMany row mapper for ${params.queryPascalName}: hasMany metadata was not provided.`);
    }
    return renderGeneratedHasManyRowMapperFile({
      header,
      importLine,
      queryPascalName: params.queryPascalName,
      relation: params.hasMany
    });
  }

  if (params.mode === 'list') {
    return [
      ...header,
      importLine,
      '',
      `export function map${params.queryPascalName}RowsToResult(rows: ${params.queryPascalName}Row[]): ${params.queryPascalName}QueryResult {`,
      `  const items = new Array<${params.queryPascalName}QueryResult['items'][number]>(rows.length);`,
      '  for (let index = 0; index < rows.length; index += 1) {',
      '    const row = rows[index];',
      ...renderGeneratedMapperAssignment('items[index]', 'row', params.fieldNames),
      '  }',
      '  return { items };',
      '}',
      ''
    ].join('\n');
  }

  const rowType = params.mode === 'optional'
    ? `${params.queryPascalName}Row | undefined`
    : `${params.queryPascalName}Row`;
  const nullGuard = params.mode === 'optional'
    ? [
      '  if (row === undefined) {',
      '    return null;',
      '  }'
    ]
    : [];

  return [
    ...header,
    importLine,
    '',
    `export function map${params.queryPascalName}RowToResult(row: ${rowType}): ${params.queryPascalName}QueryResult {`,
    ...nullGuard,
    ...renderGeneratedMapperReturnObject('row', params.fieldNames, `${params.queryPascalName}QueryResult`),
    '}',
    ''
  ].join('\n');
}

function renderGeneratedHasManyRowMapperFile(params: {
  header: string[];
  importLine: string;
  queryPascalName: string;
  relation: GeneratedHasManyRelationMetadata;
}): string {
  const collectionProperty = params.relation.collection.property;
  return [
    ...params.header,
    params.importLine,
    '',
    'function serializeGeneratedKey(values: readonly unknown[]): string {',
    "  return values.map((value) => `${typeof value}:${String(value)}`).join('|');",
    '}',
    '',
    `export function map${params.queryPascalName}RowsToResult(rows: ${params.queryPascalName}Row[]): ${params.queryPascalName}QueryResult {`,
    `  const items: ${params.queryPascalName}QueryResult['items'] = [];`,
    `  const rootIndex = new Map<string, ${params.queryPascalName}QueryResult['items'][number]>();`,
    '  for (let index = 0; index < rows.length; index += 1) {',
    '    const row = rows[index];',
    `    const rootKey = serializeGeneratedKey([${params.relation.root.key.map((column) => `row[${JSON.stringify(column)}]`).join(', ')}]);`,
    '    let root = rootIndex.get(rootKey);',
    '    if (root === undefined) {',
    '      root = {',
    ...renderGeneratedHasManyObjectProperties('        ', 'row', params.relation.root.columns),
    `        ${collectionProperty}: [],`,
    '      };',
    '      rootIndex.set(rootKey, root);',
    '      items.push(root);',
    '    }',
    `    if (${params.relation.collection.presence.map((column) => `row[${JSON.stringify(column)}] !== null && row[${JSON.stringify(column)}] !== undefined`).join(' && ')}) {`,
    `      root.${collectionProperty}.push({`,
    ...renderGeneratedHasManyObjectProperties('        ', 'row', params.relation.collection.columns),
    '      });',
    '    }',
    '  }',
    '  return { items };',
    '}',
    ''
  ].join('\n');
}

function renderGeneratedHasManyObjectProperties(
  indent: string,
  sourceName: string,
  columns: Record<string, string>
): string[] {
  return Object.entries(columns)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([property, column]) => `${indent}${property}: ${sourceName}[${JSON.stringify(column)}],`);
}

function renderGeneratedMapperReturnObject(sourceName: string, fieldNames: string[], typeName: string): string[] {
  if (fieldNames.length === 0) {
    return [`  return {} as ${typeName};`];
  }
  return [
    '  return {',
    ...fieldNames.map((fieldName) => `    ${JSON.stringify(fieldName)}: ${sourceName}[${JSON.stringify(fieldName)}],`),
    '  };'
  ];
}

function renderGeneratedMapperAssignment(targetName: string, sourceName: string, fieldNames: string[]): string[] {
  if (fieldNames.length === 0) {
    return [`    ${targetName} = {};`];
  }
  return [
    `    ${targetName} = {`,
    ...fieldNames.map((fieldName) => `      ${JSON.stringify(fieldName)}: ${sourceName}[${JSON.stringify(fieldName)}],`),
    '    };'
  ];
}

function renderExampleValue(field: RenderField): string {
  if (field.nullable) {
    return 'null';
  }
  if (field.parserKind === 'jsonObject') {
    return "{ example: 'value' }";
  }
  if (field.parserKind === 'number') {
    return '1';
  }
  if (field.parserKind === 'boolean') {
    return 'true';
  }
  return `'example_${field.name}'`;
}

function renderZodObjectSchema(
  name: string,
  fields: RenderField[],
  options: { trimStrings: boolean; rejectEmptyStrings: boolean; exported: boolean; strict?: boolean }
): string {
  const lines = [`${options.exported ? 'export ' : ''}const ${name} = z.object({`];
  for (const field of fields) {
    lines.push(`  ${field.name}: ${renderZodField(field, options)},`);
  }
  lines.push(`})${options.strict ? '.strict()' : ''};`);
  return lines.join('\n');
}

function renderZodField(
  field: RenderField,
  options: { trimStrings: boolean; rejectEmptyStrings: boolean; exported: boolean }
): string {
  let base = '';
  if (field.parserKind === 'number') {
    base = 'z.number().finite()';
  } else if (field.parserKind === 'boolean') {
    base = 'z.boolean()';
  } else if (field.parserKind === 'jsonObject') {
    base = 'z.record(z.string(), z.unknown())';
  } else {
    base = 'z.string()';
    if (options.trimStrings) {
      base += '.trim()';
    }
    if (options.rejectEmptyStrings) {
      base += `.min(1, '${field.name} must not be empty.')`;
    }
  }
  if (field.nullable) {
    base += '.nullable()';
  }
  return base;
}

function renderTypedReturnObject(fields: RenderField[], typeName: string): string[] {
  if (fields.length === 0) {
    return [`  return {} as ${typeName};`];
  }
  return [
    '  return {',
    ...fields.map((field) => `    ${field.sourceName}: request.${field.name},`),
    '  };'
  ];
}

function renderParsedObjectFromSource(sourceName: string, fields: RenderField[], schemaName: string): string[] {
  if (fields.length === 0) {
    return [`  return ${schemaName}.parse({});`];
  }
  return [
    `  return ${schemaName}.parse({`,
    ...fields.map((field) => `    ${field.name}: ${sourceName}.${field.sourceName},`),
    '  });'
  ];
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function normalizeCliPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function toProjectRelativePath(rootDir: string, filePath: string): string {
  return normalizeCliPath(path.relative(rootDir, filePath));
}

function toFeatureResourceSegment(tableName: string): string {
  const rawResource = tableName.trim().split('.').pop() ?? '';
  return rawResource
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function buildSharedOutputs(
  rootDir: string,
  paths: Pick<FeatureScaffoldPaths, 'sharedDir' | 'featureQueryExecutorFile' | 'loadSqlResourceFile'>,
  written: boolean
): FeatureScaffoldResult['outputs'] {
  const outputs: FeatureScaffoldResult['outputs'] = [];
  if (!existsSync(paths.sharedDir)) {
    outputs.push({
      path: toProjectRelativePath(rootDir, paths.sharedDir),
      written,
      kind: 'directory'
    });
  }
  if (!existsSync(paths.featureQueryExecutorFile)) {
    outputs.push({
      path: toProjectRelativePath(rootDir, paths.featureQueryExecutorFile),
      written,
      kind: 'file'
    });
  }
  if (!existsSync(paths.loadSqlResourceFile)) {
    outputs.push({
      path: toProjectRelativePath(rootDir, paths.loadSqlResourceFile),
      written,
      kind: 'file'
    });
  }
  return outputs;
}

function writeFileIfMissing(filePath: string, contents: string): void {
  if (existsSync(filePath)) {
    return;
  }
  writeFileSync(filePath, contents, 'utf8');
}

function writeFeatureFile(filePath: string, contents: string, force: boolean): void {
  if (existsSync(filePath) && !force) {
    return;
  }
  writeFileSync(filePath, contents, 'utf8');
}

function writeGeneratedFile(filePath: string, contents: string): void {
  writeFileSync(filePath, contents, 'utf8');
}

function assertFeatureWriteSafety(paths: FeatureScaffoldPaths, force: boolean): void {
  if (force) {
    return;
  }

  const existingPaths = [
    paths.entrySpecFile,
    paths.querySpecFile,
    paths.querySqlFile,
    paths.readmeFile
  ].filter((candidate) => existsSync(candidate));
  if (existingPaths.length === 0) {
    return;
  }

  const relativePaths = existingPaths.map((candidate) => normalizeCliPath(path.relative(paths.featureDir, candidate)));
  throw new Error(
    `Feature scaffold would overwrite existing files for ${path.basename(paths.featureDir)}: ${relativePaths.join(', ')}. Re-run with --force to overwrite scaffold-owned files.`
  );
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}
