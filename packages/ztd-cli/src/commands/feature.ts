import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
import { loadZtdProjectConfig, resolveGeneratedDir } from '../utils/ztdProjectConfig';
import { registerFeatureTestsScaffoldCommand } from './featureTests';

const FEATURE_ACTIONS = ['insert', 'update', 'delete', 'get-by-id', 'list'] as const;
type FeatureAction = (typeof FEATURE_ACTIONS)[number];
const DEFAULT_PAGE_SIZE = 50;
const FIXED_LAYOUT_DESCRIPTION = [
  'src/features/<feature-name>/',
  '  boundary.ts',
  '  tests/',
  '    <feature-name>.boundary.test.ts',
  '  queries/',
  '    <query-name>/',
  '      boundary.ts',
  '      <query-name>.sql',
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
  queryDir: string;
  testsDir: string;
  entryBoundaryTestFile: string;
  entrySpecFile: string;
  querySpecFile: string;
  querySqlFile: string;
  readmeFile: string;
  sharedDir: string;
  featureQueryExecutorFile: string;
  loadSqlResourceFile: string;
}

interface FeatureScaffoldResult {
  featureName: string;
  queryName: string;
  action: FeatureAction;
  table: string;
  primaryKeyColumn: string;
  source: FeatureScaffoldSourceName;
  dryRun: boolean;
  outputs: Array<{ path: string; written: boolean; kind: 'directory' | 'file' }>;
}

export function registerFeatureCommand(program: Command): void {
  const feature = program.command('feature').description('Scaffold feature-local files from schema metadata');
  registerFeatureTestsScaffoldCommand(feature);

  feature
    .command('scaffold')
    .description('Scaffold a feature-local CRUD or SELECT boundary skeleton from schema metadata')
    .requiredOption('--table <table>', 'Target table name')
    .requiredOption('--action <action>', 'Feature action template to scaffold (v1 supports insert, update, delete, get-by-id, and list)')
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
      `- Run \`ztd feature tests scaffold --feature ${result.featureName}\` after you finish SQL and DTO edits.`,
      `- That command will refresh src/features/${result.featureName}/queries/${result.queryName}/tests/generated/TEST_PLAN.md and analysis.json, while AI-authored cases stay in src/features/${result.featureName}/queries/${result.queryName}/tests/cases/.`
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
    featureName,
    queryName,
    action,
    table: input.table,
    primaryKeyColumn,
  });
  assertFeatureWriteSafety(paths, options.force === true);
  const sharedOutputs = buildSharedOutputs(rootDir, paths, !options.dryRun);

  const outputs: FeatureScaffoldResult['outputs'] = [
    ...sharedOutputs,
    { path: toProjectRelativePath(rootDir, paths.featureDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.testsDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.queryDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.entryBoundaryTestFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.entrySpecFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.querySpecFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.querySqlFile), written: !options.dryRun, kind: 'file' },
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
      dryRun: true,
      outputs
    };
  }

  ensureDirectory(paths.sharedDir);
  ensureDirectory(paths.featureDir);
  ensureDirectory(paths.testsDir);
  ensureDirectory(paths.queryDir);
  writeFileIfMissing(paths.featureQueryExecutorFile, contents.featureQueryExecutorFile);
  writeFileIfMissing(paths.loadSqlResourceFile, contents.loadSqlResourceFile);
  writeFileIfMissing(paths.entryBoundaryTestFile, contents.entrySpecTestFile);
  writeFeatureFile(paths.entrySpecFile, contents.entrySpecFile, options.force === true);
  writeFeatureFile(paths.querySpecFile, contents.querySpecFile, options.force === true);
  writeFeatureFile(paths.querySqlFile, contents.querySqlFile, options.force === true);
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
    dryRun: false,
    outputs
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
    readmeFile: path.join(featureDir, 'README.md'),
    sharedDir,
    featureQueryExecutorFile: path.join(sharedDir, 'featureQueryExecutor.ts'),
    loadSqlResourceFile: path.join(sharedDir, 'loadSqlResource.ts')
  };
}

function renderFeatureScaffoldFiles(params: {
  featureName: string;
  queryName: string;
  action: FeatureAction;
  table: DdlTableMetadata;
  primaryKeyColumn: string;
}): {
  entrySpecFile: string;
  entrySpecTestFile: string;
  querySpecFile: string;
  querySqlFile: string;
  readmeFile: string;
  featureQueryExecutorFile: string;
  loadSqlResourceFile: string;
} {
  const pascalName = toPascalCase(params.featureName);
  const entryCamelName = toCamelCase(params.featureName);
  const queryPascalName = toPascalCase(params.queryName);
  const queryCamelName = toCamelCase(params.queryName);
  const actionPlan = buildActionPlan(params.action, params.table, params.primaryKeyColumn);
  const requestFields = actionPlan.requestColumns.map((column) => toRenderField(column));
  const responseFields = actionPlan.resultColumns.map((column) => toRenderField(column));
  const sqlFile = renderActionSql(actionPlan, params.table.canonicalName, params.primaryKeyColumn);
  const featureQueryExecutorFile = [
    '// Shared runtime contract for scaffolded features.',
    '// Inject your DB execution implementation at this seam from the application runtime.',
    'export interface FeatureQueryExecutor {',
    '  query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]>;',
    '}',
    ''
  ].join('\n');
  const loadSqlResourceFile = [
    "import { readFileSync } from 'node:fs';",
    "import path from 'node:path';",
    '',
    'export function loadSqlResource(currentDir: string, relativePath: string): string {',
    "  return readFileSync(path.join(currentDir, relativePath), 'utf8');",
    '}',
    ''
  ].join('\n');
  const entrySpecFile = renderEntrySpecFile({
    action: params.action,
    featureName: params.featureName,
    pascalName,
    entryCamelName,
    queryName: params.queryName,
    queryPascalName,
    queryCamelName,
    requestFields,
    responseFields
  });
  const querySpecFile = renderQuerySpecFile({
    action: params.action,
    queryName: params.queryName,
    featureName: params.featureName,
    queryPascalName,
    queryCamelName,
    requestFields,
    responseFields
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
    defaultExpressionColumns: actionPlan.queryColumns.filter((column) => column.source === 'ddl-default').map((column) => column.name)
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
    readmeFile,
    featureQueryExecutorFile,
    loadSqlResourceFile
  };
}

type RenderField = {
  name: string;
  typeScriptType: string;
  parserKind: 'string' | 'number' | 'boolean';
  nullable: boolean;
  sourceType: string;
};

type QueryColumn = {
  name: string;
  expression: string;
  source: 'param' | 'ddl-default' | 'selected';
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

function buildActionPlan(
  action: FeatureAction,
  table: DdlTableMetadata,
  primaryKeyColumn: string
): ActionPlan {
  if (action === 'insert') {
    const queryColumns = selectInsertSqlColumns(table, primaryKeyColumn);
    return {
      action,
      requestColumns: table.columns
        .filter((column) => !isGeneratedInsertColumn(column, primaryKeyColumn) && column.defaultValue == null),
      resultColumns: [requireColumn(table, primaryKeyColumn)],
      queryColumns,
      writeColumns: queryColumns,
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

function selectInsertSqlColumns(table: DdlTableMetadata, primaryKeyColumn: string): QueryColumn[] {
  return table.columns
    .filter((column) => !isGeneratedInsertColumn(column, primaryKeyColumn))
    .map((column) => ({
      name: column.name,
      expression: column.defaultValue ?? `:${column.name}`,
      source: column.defaultValue == null ? 'param' : 'ddl-default'
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
    if (plan.writeColumns.length === 0) {
      return [
        `insert into ${quotedTableName}`,
        'default values',
        `returning ${quotedPrimaryKeyColumn};`,
        ''
      ].join('\n');
    }

    return [
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

function toRenderField(column: ScaffoldColumnMetadata): RenderField {
  const typeName = (column.typeName ?? '').trim().toLowerCase();
  if (isBigIntLikeType(typeName)) {
    return {
      name: column.name,
      typeScriptType: column.isNotNull ? 'string' : 'string | null',
      parserKind: 'string',
      nullable: !column.isNotNull,
      sourceType: column.typeName ?? 'bigint'
    };
  }
  if (isStringEncodedNumericType(typeName)) {
    return {
      name: column.name,
      typeScriptType: column.isNotNull ? 'string' : 'string | null',
      parserKind: 'string',
      nullable: !column.isNotNull,
      sourceType: column.typeName ?? 'numeric'
    };
  }
  if (isNumberType(typeName)) {
    return {
      name: column.name,
      typeScriptType: column.isNotNull ? 'number' : 'number | null',
      parserKind: 'number',
      nullable: !column.isNotNull,
      sourceType: column.typeName ?? 'numeric'
    };
  }
  if (typeName === 'boolean' || typeName === 'bool') {
    return {
      name: column.name,
      typeScriptType: column.isNotNull ? 'boolean' : 'boolean | null',
      parserKind: 'boolean',
      nullable: !column.isNotNull,
      sourceType: column.typeName ?? 'boolean'
    };
  }
  return {
    name: column.name,
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
    ...renderEntrySpecBoundaryComments(params.action),
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
    '  return ResponseSchema.parse(result);',
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
  featureName: string;
  queryPascalName: string;
  queryCamelName: string;
  requestFields: RenderField[];
  responseFields: RenderField[];
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
    '',
    "import type { FeatureQueryExecutor } from '../../../_shared/featureQueryExecutor.js';",
    "import { loadSqlResource } from '../../../_shared/loadSqlResource.js';",
    '',
    `const ${params.queryCamelName}SqlResource = loadSqlResource(__dirname, '${params.queryName}.sql');`,
    '',
    ...renderQuerySpecBoundaryComments(params.action),
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
    `type ${params.queryPascalName}Row = z.infer<typeof RowSchema>;`,
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
    '/** Maps a query row into the query result contract. */',
    `function mapRowToResult(row: ${params.queryPascalName}Row): ${params.queryPascalName}QueryResult {`,
    '  return QueryResultSchema.parse(row);',
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
    '  return mapRowToResult(row);',
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
      ? '- No general insert columns used DDL-backed default expressions in this scaffold.'
      : params.action === 'get-by-id' || params.action === 'list'
        ? '- Read baselines do not infer additional filter or default-expression policy beyond the explicit SQL and spec contract.'
        : '- Write baselines do not infer additional default-expression or policy behavior beyond the explicit SQL and spec contract.';

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
    `- \`queries/${params.queryName}/tests/\``,
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
    `- \`queries/${params.queryName}/tests/boundary-ztd-types.ts\``,
    `- \`queries/${params.queryName}/tests/generated/TEST_PLAN.md\``,
    `- \`queries/${params.queryName}/tests/generated/analysis.json\``,
    `- generated/* is CLI-owned and refreshable.`,
    '',
    '## Human/AI-owned persistent files',
    '',
    `- persistent case files under \`queries/${params.queryName}/tests/cases/\``,
    `- cases/* is human/AI-owned and kept.`,
    `- \`queries/${params.queryName}/tests/${params.queryName}.boundary.ztd.test.ts\` is a thin Vitest entrypoint and is kept.`,
    '',
    '## Boundary responsibilities',
    '',
    '- `boundary.ts` is the feature boundary public surface for request parsing, normalization, rejection, query-parameter assembly, and response shaping.',
    ...renderReadmeEntryspecNotes(params.action, params.parameterColumns),
    '- `boundary.ts` keeps its schema values and helper functions file-local; it converts request data to query params explicitly and depends on the shared executor contract directly.',
    `- \`queries/${params.queryName}/boundary.ts\` is the query-boundary public surface for query params, row shape, query result shape, row-to-result mapping, and SQL execution contract.`,
    `- \`queries/${params.queryName}/boundary.ts\` keeps its \`zod\` schema values, row type, and helper functions private, completes params / row / result parsing internally, and depends on the shared executor contract directly.`,
    `- \`queries/${params.queryName}/boundary.ts\` and \`queries/${params.queryName}/${params.queryName}.sql\` stay co-located as one boundary/SQL pair.`,
    `- \`tests/${params.featureName}.boundary.test.ts\` is the thin Vitest entrypoint for the feature boundary lane.`,
    `- \`queries/${params.queryName}/tests/${params.queryName}.boundary.ztd.test.ts\` is the thin Vitest entrypoint for the ZTD query lane.`,
    generatedColumnsLine,
    queryColumnsLine,
    parameterColumnsLine,
    defaultExpressionColumnsLine,
    ...renderReadmeOperationNotes(params.action, params.primaryKeyColumn),
    '',
    '## Follow-up query growth',
    '',
    `- Keep this baseline as one workflow and one primary query by default; add another sibling query directory under \`queries/\` only if a follow-up intentionally expands the feature.`,
    '- If a follow-up adds another query directory, keep each query directory self-contained with exactly one `boundary.ts` and one SQL resource.',
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

function renderEntrySpecBoundaryComments(action: FeatureAction): string[] {
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
      '// DDL-backed default expressions are written into the SQL resource explicitly.'
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

function renderQuerySpecBoundaryComments(action: FeatureAction): string[] {
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
      '// DDL-backed defaults are reflected directly in the SQL resource.'
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

function renderReadmeOperationNotes(action: FeatureAction, primaryKeyColumn: string): string[] {
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
      '- SQL omits only generated / identity / sequence-backed primary keys. Every other insert column stays explicit in the scaffold SQL.',
      '- When DDL declares a column default, the scaffold writes that default expression into SQL explicitly instead of relying on an implicit database default at runtime.',
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
    `  return ResponseSchema.parse(result);`,
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
    '  return ResponseSchema.parse(result);',
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
  featureName: string;
  queryPascalName: string;
  queryCamelName: string;
  requestFields: RenderField[];
  responseFields: RenderField[];
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
    '',
    "import type { FeatureQueryExecutor } from '../../../_shared/featureQueryExecutor.js';",
    "import { loadSqlResource } from '../../../_shared/loadSqlResource.js';",
    '',
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
    `type ${params.queryPascalName}Row = z.infer<typeof RowSchema>;`,
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
    '/** Maps a query row into the query result contract. */',
    `function mapRowToResult(row: ${params.queryPascalName}Row | undefined): ${params.queryPascalName}QueryResult {`,
    '  if (row === undefined) {',
    '    return null;',
    '  }',
    `  return QueryResultSchema.parse(row);`,
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
    '  return mapRowToResult(row);',
    '}',
    ''
  ].join('\n');
}

function renderListQuerySpecFile(params: {
  action: FeatureAction;
  queryName: string;
  featureName: string;
  queryPascalName: string;
  queryCamelName: string;
  requestFields: RenderField[];
  responseFields: RenderField[];
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
    '',
    "import type { FeatureQueryExecutor } from '../../../_shared/featureQueryExecutor.js';",
    "import { createCatalogExecutor, type QuerySpec } from '@rawsql-ts/sql-contract';",
    "import { loadSqlResource } from '../../../_shared/loadSqlResource.js';",
    '',
    `const DEFAULT_PAGE_SIZE = ${DEFAULT_PAGE_SIZE};`,
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
    `type ${params.queryPascalName}Row = z.infer<typeof RowSchema>;`,
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
    `  id: '${params.featureName}/queries/${params.queryName}/spec',`,
    `  sqlFile: 'src/features/${params.featureName}/queries/${params.queryName}/${params.queryName}.sql',`,
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
    '/** Maps query rows into the query result contract. */',
    `function mapRowsToResult(rows: ${params.queryPascalName}Row[]): ${params.queryPascalName}QueryResult {`,
    '  return QueryResultSchema.parse({ items: rows });',
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
    '  return mapRowsToResult(rows);',
    '}',
    ''
  ].join('\n');
}

function renderExampleValue(field: RenderField): string {
  if (field.nullable) {
    return 'null';
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
    ...fields.map((field) => `    ${field.name}: request.${field.name},`),
    '  };'
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
