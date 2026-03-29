import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import {
  CreateTableQuery,
  MultiQuerySplitter,
  SqlParser,
  type ColumnConstraintDefinition,
  type TableColumnDefinition
} from 'rawsql-ts';
import { emitDiagnostic, isJsonOutput, writeCommandEnvelope } from '../utils/agentCli';
import { ensureDirectory } from '../utils/fs';
import { collectSqlFiles, type SqlSource } from '../utils/collectSqlFiles';
import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';

const FEATURE_ACTION = 'insert';
const FIXED_LAYOUT_DESCRIPTION = [
  'src/features/<feature-name>/',
  '  sql/',
  '    <feature-name>.sql',
  '  tests/',
  '    <feature-name>.queryspec.test.ts',
  '    <feature-name>.feature.test.ts',
  '  <feature-name>.ts',
  '  README.md'
].join('\n');

type FeatureCommandOptions = {
  table?: string;
  action?: string;
  featureName?: string;
  dryRun?: boolean;
  force?: boolean;
  rootDir?: string;
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
  sqlDir: string;
  testsDir: string;
  featureFile: string;
  sqlFile: string;
  readmeFile: string;
  sharedDir: string;
  loadSqlResourceFile: string;
  queryOneExactFile: string;
}

interface FeatureScaffoldResult {
  featureName: string;
  action: 'insert';
  table: string;
  primaryKeyColumn: string;
  source: FeatureScaffoldSourceName;
  dryRun: boolean;
  outputs: Array<{ path: string; written: boolean; kind: 'directory' | 'file' }>;
}

export function registerFeatureCommand(program: Command): void {
  const feature = program.command('feature').description('Scaffold feature-local files from schema metadata');

  feature
    .command('scaffold')
    .description('Scaffold a feature shell, SQL, and README for one feature-local insert flow')
    .requiredOption('--table <table>', 'Target table name')
    .requiredOption('--action <action>', 'Feature action template to scaffold (v1 supports only insert)')
    .option('--feature-name <name>', 'Override the derived feature name')
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
        '',
        'Created by CLI:',
        ...result.outputs.map((output) => `- ${output.path}`),
        '',
        'Reserved for AI follow-up (not created by the CLI):',
        `- src/features/${result.featureName}/tests/${result.featureName}.queryspec.test.ts`,
        `- src/features/${result.featureName}/tests/${result.featureName}.feature.test.ts`
      ];
      process.stdout.write(`${lines.join('\n')}\n`);
    });
}

export async function runFeatureScaffoldCommand(options: FeatureCommandOptions): Promise<FeatureScaffoldResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const action = normalizeFeatureAction(options.action);
  const config = loadZtdProjectConfig(rootDir);
  const featureName = normalizeFeatureName(
    options.featureName ?? deriveFeatureName(options.table ?? '', action)
  );

  const generatedMetadataAssessment = assessGeneratedMetadataCapability(rootDir);
  const input = resolveFeatureScaffoldInput({
    projectRoot: rootDir,
    table: options.table ?? '',
    config,
    generatedMetadataAssessment
  });
  const primaryKeyColumn = resolvePrimaryKeyColumn(input.table);
  const paths = buildFeatureScaffoldPaths(rootDir, featureName);
  const contents = renderFeatureScaffoldFiles({
    featureName,
    action,
    table: input.table,
    primaryKeyColumn,
  });
  assertFeatureWriteSafety(paths, options.force === true);
  const sharedOutputs = buildSharedOutputs(rootDir, paths, !options.dryRun);

  const outputs: FeatureScaffoldResult['outputs'] = [
    ...sharedOutputs,
    { path: toProjectRelativePath(rootDir, paths.featureDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.sqlDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.testsDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.featureFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.sqlFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.readmeFile), written: !options.dryRun, kind: 'file' },
  ];

  if (options.dryRun) {
    return {
      featureName,
      action,
      table: input.table.canonicalName,
      primaryKeyColumn,
      source: input.source,
      dryRun: true,
      outputs
    };
  }

  ensureDirectory(paths.sharedDir);
  ensureDirectory(paths.featureDir);
  ensureDirectory(paths.sqlDir);
  ensureDirectory(paths.testsDir);
  writeFileIfMissing(paths.loadSqlResourceFile, contents.loadSqlResourceFile);
  writeFileIfMissing(paths.queryOneExactFile, contents.queryOneExactFile);
  writeFeatureFile(paths.featureFile, contents.featureFile, options.force === true);
  writeFeatureFile(paths.sqlFile, contents.sqlFile, options.force === true);
  writeFeatureFile(paths.readmeFile, contents.readmeFile, options.force === true);

  emitDiagnostic({
    code: 'feature-scaffold.ai-follow-up',
    message: `CLI created src/features/${featureName}/tests/ only. Add src/features/${featureName}/tests/${featureName}.queryspec.test.ts and src/features/${featureName}/tests/${featureName}.feature.test.ts as the AI follow-up.`
  });

  return {
    featureName,
    action,
    table: input.table.canonicalName,
    primaryKeyColumn,
    source: input.source,
    dryRun: false,
    outputs
  };
}

export function deriveFeatureName(tableName: string, action: string): string {
  const resourceSegment = toFeatureResourceSegment(tableName);
  return `${resourceSegment}-${action.trim().toLowerCase()}`;
}

export function normalizeFeatureAction(action: string | undefined): 'insert' {
  const normalized = (action ?? '').trim().toLowerCase();
  if (normalized !== FEATURE_ACTION) {
    throw new Error(`Unsupported --action value: ${action}. v1 supports only insert.`);
  }
  return FEATURE_ACTION;
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

export function assessGeneratedMetadataCapability(projectRoot: string): GeneratedMetadataAssessment {
  const generatedManifestPath = path.join(projectRoot, 'tests', 'generated', 'ztd-fixture-manifest.generated.ts');
  const reasons: string[] = [];
  if (!existsSync(generatedManifestPath)) {
    reasons.push('tests/generated/ztd-fixture-manifest.generated.ts is missing.');
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
  if (!defaultConstraint?.defaultValue) {
    return null;
  }
  const value = defaultConstraint.defaultValue;
  if ('toSql' in value && typeof value.toSql === 'function') {
    return value.toSql();
  }
  return String(value);
}

function resolveRequestedTable(
  rawTableName: string,
  tables: DdlTableMetadata[],
  defaultSchema: string,
  searchPath: string[]
): DdlTableMetadata | undefined {
  const normalized = rawTableName.trim().toLowerCase();
  if (normalized.includes('.')) {
    const canonical = normalized || `${defaultSchema}.${normalized}`;
    const canonicalMatch = tables.find((table) => table.canonicalName.toLowerCase() === canonical);
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

function buildFeatureScaffoldPaths(rootDir: string, featureName: string): FeatureScaffoldPaths {
  const featureDir = path.join(rootDir, 'src', 'features', featureName);
  const sharedDir = path.join(rootDir, 'src', 'features', '_shared');
  return {
    featureDir,
    sqlDir: path.join(featureDir, 'sql'),
    testsDir: path.join(featureDir, 'tests'),
    featureFile: path.join(featureDir, `${featureName}.ts`),
    sqlFile: path.join(featureDir, 'sql', `${featureName}.sql`),
    readmeFile: path.join(featureDir, 'README.md'),
    sharedDir,
    loadSqlResourceFile: path.join(sharedDir, 'loadSqlResource.ts'),
    queryOneExactFile: path.join(sharedDir, 'queryOneExact.ts')
  };
}

function renderFeatureScaffoldFiles(params: {
  featureName: string;
  action: 'insert';
  table: DdlTableMetadata;
  primaryKeyColumn: string;
}): {
  featureFile: string;
  sqlFile: string;
  readmeFile: string;
  loadSqlResourceFile: string;
  queryOneExactFile: string;
} {
  const pascalName = toPascalCase(params.featureName);
  const camelName = toCamelCase(params.featureName);
  const columnAssignments = params.table.columns.map((column) => `  :${column.name}`).join(',\n');
  const columnList = params.table.columns.map((column) => `  ${column.name}`).join(',\n');
  const inputFields = params.table.columns.map((column) => `  ${column.name}: unknown;`).join('\n');
  const featureSlug = params.featureName;
  const loadSqlResourceFile = [
    "import { readFileSync } from 'node:fs';",
    "import path from 'node:path';",
    '',
    'export function loadSqlResource(currentDir: string, relativePath: string): string {',
    "  return readFileSync(path.join(currentDir, relativePath), 'utf8');",
    '}',
    ''
  ].join('\n');
  const queryOneExactFile = [
    'export interface FeatureQueryExecutor {',
    '  query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]>;',
    '}',
    '',
    'export async function queryOneExact<TResult>(',
    '  executor: FeatureQueryExecutor,',
    '  sql: string,',
    '  params: Record<string, unknown>,',
    '  label: string',
    '): Promise<TResult> {',
    '  const rows = await executor.query<TResult>(sql, params);',
    '  if (rows.length === 0) {',
    "    throw new Error(`Expected exactly one row from ${label}, received none.`);",
    '  }',
    '  if (rows.length > 1) {',
    "    throw new Error(`Expected exactly one row from ${label}, received ${rows.length}.`);",
    '  }',
    '  return rows[0];',
    '}',
    ''
  ].join('\n');
  const featureFile = [
    "import { loadSqlResource } from '../_shared/loadSqlResource';",
    "import { queryOneExact, type FeatureQueryExecutor } from '../_shared/queryOneExact';",
    '',
    `const ${camelName}SqlResource = loadSqlResource(__dirname, 'sql/${featureSlug}.sql');`,
    '',
    `export interface ${pascalName}Input {`,
    inputFields,
    '}',
    '',
    `export interface ${pascalName}Result {`,
    `  ${params.primaryKeyColumn}: unknown;`,
    '}',
    '',
    `export async function ${camelName}(executor: FeatureQueryExecutor, input: ${pascalName}Input): Promise<${pascalName}Result> {`,
    `  return queryOneExact<${pascalName}Result>(executor, ${camelName}SqlResource, input, '${featureSlug}');`,
    '}',
    ''
  ].join('\n');

  const sqlFile = [
    `insert into ${params.table.canonicalName} (`,
    columnList,
    ') values (',
    columnAssignments,
    `) returning ${params.primaryKeyColumn};`,
    ''
  ].join('\n');

  const readmeFile = [
    `# ${params.featureName}`,
    '',
    '## Purpose',
    '',
    `Scaffold a minimal ${params.action} feature implementation for \`${params.table.canonicalName}\`.`,
    '',
    '## Fixed feature layout contract',
    '',
    '```text',
    FIXED_LAYOUT_DESCRIPTION,
    '```',
    '',
    '## v1 CLI-created files',
    '',
    '- feature directory',
    '- `sql/`',
    '- `tests/`',
    `- \`${params.featureName}.ts\``,
    `- \`sql/${params.featureName}.sql\``,
    '- `README.md`',
    '',
    '## Shared helper files created by the CLI when missing',
    '',
    '- `src/features/_shared/loadSqlResource.ts`',
    '- `src/features/_shared/queryOneExact.ts`',
    '',
    '## v1 AI-created files',
    '',
    `- \`tests/${params.featureName}.queryspec.test.ts\``,
    `- \`tests/${params.featureName}.feature.test.ts\``,
    '',
    '## Execution seam contract',
    '',
    '- Keep `sql/' + params.featureName + '.sql` as the SQL file resource.',
    '- Do not inline SQL text into `' + params.featureName + '.ts`.',
    '- Load the SQL file resource through `src/features/_shared/loadSqlResource.ts`.',
    '- Execute the one-row path through `src/features/_shared/queryOneExact.ts`.',
    '- Expect exactly one row from the executor.',
    '- Return the primary-key-only result shape from that one row.',
    '',
    '## Runtime input policy',
    '',
    '- DDL remains the source of truth.',
    '- v1 uses local DDL parsing because generated metadata does not yet expose explicit primary key structure.',
    '- When generated metadata gains explicit primary key and identity semantics, scaffold runtime input can switch without changing the public CLI contract.',
    '',
    '## Implemented by the CLI',
    '',
    '- Create the fixed feature directory layout.',
    '- Create the SQL file resource and keep named parameters aligned with DB column names.',
    '- Create shared SQL-resource and one-row execution helpers when they are missing.',
    '- Create the TypeScript entrypoint with shared helper calls instead of inline file I/O or row-count checks.',
    '- Enforce the exactly-one-row expectation for the primary-key-only result through the shared executor seam.',
    '',
    '## Open questions',
    '',
    '- Keep the current import-time `readFileSync(... __dirname ...)` seam for v1, or switch to a shared helper later.',
    '- Consider lazy-loading or caching the SQL file resource if repeated imports become a concern.',
    '- Decide whether a shared SQL-resource helper should become part of the scaffold contract in a later revision.',
    '',
    '## Follow-up customization points',
    '',
    '- Narrow the TypeScript input and result types once follow-up requirements are known.',
    '- Remove default or generated columns from the insert if the feature contract needs it.',
    '- Add QuerySpec and feature tests as the AI-owned follow-up step.',
    ''
  ].join('\n');

  return { featureFile, sqlFile, readmeFile, loadSqlResourceFile, queryOneExactFile };
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
  paths: FeatureScaffoldPaths,
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
  if (!existsSync(paths.loadSqlResourceFile)) {
    outputs.push({
      path: toProjectRelativePath(rootDir, paths.loadSqlResourceFile),
      written,
      kind: 'file'
    });
  }
  if (!existsSync(paths.queryOneExactFile)) {
    outputs.push({
      path: toProjectRelativePath(rootDir, paths.queryOneExactFile),
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

function assertFeatureWriteSafety(paths: FeatureScaffoldPaths, force: boolean): void {
  if (force) {
    return;
  }

  const existingPaths = [paths.featureFile, paths.sqlFile, paths.readmeFile].filter((candidate) => existsSync(candidate));
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
