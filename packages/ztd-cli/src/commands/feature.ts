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
import { loadZtdProjectConfig } from '../utils/ztdProjectConfig';

const FEATURE_ACTIONS = ['insert', 'update', 'delete'] as const;
type FeatureAction = (typeof FEATURE_ACTIONS)[number];
const FIXED_LAYOUT_DESCRIPTION = [
  'src/features/<feature-name>/',
  '  entryspec.ts',
  '  <query-name>/',
  '    queryspec.ts',
  '    <query-name>.sql',
  '  tests/',
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
  action: FeatureAction;
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
    .description('Scaffold a feature-local CRUD boundary skeleton from schema metadata')
    .requiredOption('--table <table>', 'Target table name')
    .requiredOption('--action <action>', 'Feature action template to scaffold (v1 supports insert, update, and delete)')
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
    { path: toProjectRelativePath(rootDir, paths.queryDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.testsDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, paths.entrySpecFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.querySpecFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, paths.querySqlFile), written: !options.dryRun, kind: 'file' },
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
  ensureDirectory(paths.queryDir);
  ensureDirectory(paths.testsDir);
  writeFileIfMissing(paths.featureQueryExecutorFile, contents.featureQueryExecutorFile);
  writeFileIfMissing(paths.loadSqlResourceFile, contents.loadSqlResourceFile);
  writeFeatureFile(paths.entrySpecFile, contents.entrySpecFile, options.force === true);
  writeFeatureFile(paths.querySpecFile, contents.querySpecFile, options.force === true);
  writeFeatureFile(paths.querySqlFile, contents.querySqlFile, options.force === true);
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

export function normalizeFeatureAction(action: string | undefined): FeatureAction {
  const normalized = (action ?? '').trim().toLowerCase();
  if (FEATURE_ACTIONS.includes(normalized as FeatureAction)) {
    return normalized as FeatureAction;
  }
  throw new Error(`Unsupported --action value: ${action}. v1 supports only insert, update, and delete.`);
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
    queryDir: path.join(featureDir, queryName),
    testsDir: path.join(featureDir, 'tests'),
    entrySpecFile: path.join(featureDir, 'entryspec.ts'),
    querySpecFile: path.join(featureDir, queryName, 'queryspec.ts'),
    querySqlFile: path.join(featureDir, queryName, `${queryName}.sql`),
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
  const responseField = toRenderField(
    params.table.columns.find((column) => column.name === params.primaryKeyColumn) ?? {
      name: params.primaryKeyColumn,
      typeName: 'integer',
      isNotNull: true,
      defaultValue: null,
      hasGeneratedIdentity: false
    }
  );
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
    responseField
  });
  const querySpecFile = renderQuerySpecFile({
    action: params.action,
    queryName: params.queryName,
    featureName: params.featureName,
    queryPascalName,
    queryCamelName,
    requestFields,
    responseField
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
    parameterColumns: actionPlan.queryColumns.filter((column) => column.source === 'param').map((column) => column.name),
    defaultExpressionColumns: actionPlan.queryColumns.filter((column) => column.source === 'ddl-default').map((column) => column.name)
  });

  return {
    entrySpecFile,
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

type InsertSqlColumn = {
  name: string;
  expression: string;
  source: 'param' | 'ddl-default';
};

type ActionPlan = {
  action: FeatureAction;
  requestColumns: ScaffoldColumnMetadata[];
  queryColumns: InsertSqlColumn[];
  writeColumns: InsertSqlColumn[];
  whereColumns: InsertSqlColumn[];
};

function deriveQueryName(tableName: string, action: FeatureAction): string {
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
      queryColumns: [...whereColumns, ...writeColumns],
      writeColumns,
      whereColumns
    };
  }

  const primaryKey = requireColumn(table, primaryKeyColumn);
  const whereColumns = [{ name: primaryKey.name, expression: `:${primaryKey.name}`, source: 'param' as const }];
  return {
    action,
    requestColumns: [primaryKey],
    queryColumns: whereColumns,
    writeColumns: [],
    whereColumns
  };
}

function selectInsertSqlColumns(table: DdlTableMetadata, primaryKeyColumn: string): InsertSqlColumn[] {
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
  if (normalizedType === 'serial' || normalizedType === 'bigserial' || normalizedType === 'smallserial') {
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

function isNumberType(typeName: string): boolean {
  return [
    'serial',
    'bigserial',
    'smallserial',
    'int',
    'int2',
    'int4',
    'int8',
    'integer',
    'bigint',
    'smallint',
    'numeric',
    'decimal',
    'real',
    'float',
    'float4',
    'float8',
    'double precision'
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
  responseField: RenderField;
}): string {
  const rawRequestSchema = renderZodObjectSchema(`${params.entryCamelName}RawRequestSchema`, params.requestFields, {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false
  });
  const responseSchema = renderZodObjectSchema(`${params.entryCamelName}ResponseSchema`, [params.responseField], {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false
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
    "import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor';",
    '',
    `import {`,
      `  execute${params.queryPascalName}QuerySpec,`,
    `  type ${params.queryPascalName}QueryParams,`,
    `  type ${params.queryPascalName}QueryResult`,
    `} from './${params.queryName}/queryspec';`,
    '',
    ...renderEntrySpecBoundaryComments(params.action),
    '',
    rawRequestSchema,
    '',
    `export type ${params.pascalName}Request = z.infer<typeof ${params.entryCamelName}RawRequestSchema>;`,
    '',
    responseSchema,
    '',
    `export type ${params.pascalName}Response = z.infer<typeof ${params.entryCamelName}ResponseSchema>;`,
    '',
    `function parse${params.pascalName}Request(raw: unknown): ${params.pascalName}Request {`,
    `  return ${params.entryCamelName}RawRequestSchema.parse(raw);`,
    '}',
    '',
    `function normalize${params.pascalName}Request(request: ${params.pascalName}Request): ${params.pascalName}Request {`,
    ...normalizeLines,
    '}',
    '',
    `function reject${params.pascalName}Request(request: ${params.pascalName}Request): void {`,
    ...(rejectLines.length > 0
      ? rejectLines
      : ['  // Add feature-level reject rules here when follow-up requirements appear.']),
    '}',
    '',
    `function to${params.queryPascalName}QueryParams(request: ${params.pascalName}Request): ${params.queryPascalName}QueryParams {`,
    ...renderTypedReturnObject(params.requestFields, `${params.queryPascalName}QueryParams`),
    '}',
    '',
    `function from${params.queryPascalName}QueryResult(result: ${params.queryPascalName}QueryResult): ${params.pascalName}Response {`,
    `  return ${params.entryCamelName}ResponseSchema.parse(result);`,
    '}',
    '',
    `export async function execute${params.pascalName}EntrySpec(`,
    '  executor: FeatureQueryExecutor,',
    '  rawRequest: unknown',
    `): Promise<${params.pascalName}Response> {`,
    `  const request = normalize${params.pascalName}Request(parse${params.pascalName}Request(rawRequest));`,
    `  reject${params.pascalName}Request(request);`,
    `  const result = await execute${params.queryPascalName}QuerySpec(executor, to${params.queryPascalName}QueryParams(request));`,
    `  return from${params.queryPascalName}QueryResult(result);`,
    '}',
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
  responseField: RenderField;
}): string {
  const paramsSchema = renderZodObjectSchema(`${params.queryCamelName}QueryParamsSchema`, params.requestFields, {
    trimStrings: false,
    rejectEmptyStrings: true,
    exported: false
  });
  const rowSchema = renderZodObjectSchema(`${params.queryCamelName}RowSchema`, [params.responseField], {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false
  });
  const resultSchema = renderZodObjectSchema(`${params.queryCamelName}QueryResultSchema`, [params.responseField], {
    trimStrings: false,
    rejectEmptyStrings: false,
    exported: false
  });

  return [
    "import { z } from 'zod';",
    '',
    "import type { FeatureQueryExecutor } from '../../_shared/featureQueryExecutor';",
    "import { queryExactlyOneRow, type QueryParams } from '@rawsql-ts/sql-contract';",
    "import { loadSqlResource } from '../../_shared/loadSqlResource';",
    '',
    `const ${params.queryCamelName}SqlResource = loadSqlResource(__dirname, '${params.queryName}.sql');`,
    '',
    ...renderQuerySpecBoundaryComments(params.action),
    paramsSchema,
    '',
    `export type ${params.queryPascalName}QueryParams = z.infer<typeof ${params.queryCamelName}QueryParamsSchema>;`,
    '',
    rowSchema,
    '',
    resultSchema,
    '',
    `export type ${params.queryPascalName}QueryResult = z.infer<typeof ${params.queryCamelName}QueryResultSchema>;`,
    '',
    `type ${params.queryPascalName}Row = z.infer<typeof ${params.queryCamelName}RowSchema>;`,
    '',
    `function parse${params.queryPascalName}QueryParams(raw: unknown): ${params.queryPascalName}QueryParams {`,
    `  return ${params.queryCamelName}QueryParamsSchema.parse(raw);`,
    '}',
    '',
    `function parse${params.queryPascalName}Row(raw: unknown): ${params.queryPascalName}Row {`,
    `  return ${params.queryCamelName}RowSchema.parse(raw);`,
    '}',
    '',
    `function map${params.queryPascalName}RowToResult(row: ${params.queryPascalName}Row): ${params.queryPascalName}QueryResult {`,
    `  return ${params.queryCamelName}QueryResultSchema.parse(row);`,
    '}',
    '',
    `export async function execute${params.queryPascalName}QuerySpec(`,
    `  executor: FeatureQueryExecutor,`,
    `  rawParams: unknown`,
    `): Promise<${params.queryPascalName}QueryResult> {`,
    `  const params = parse${params.queryPascalName}QueryParams(rawParams);`,
    `  const row = await queryExactlyOneRow<Record<string, unknown>>(`,
    '    (sql, params) => executor.query(sql, params as Record<string, unknown>),',
    `    ${params.queryCamelName}SqlResource,`,
    '    params as QueryParams,',
    `    { label: '${params.featureName}/${params.queryName}/queryspec' }`,
    '  );',
    `  return map${params.queryPascalName}RowToResult(parse${params.queryPascalName}Row(row));`,
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
  const generatedColumnsLine = params.generatedColumns.length > 0
    ? `- Generated / identity / sequence-backed columns excluded at scaffold time: ${params.generatedColumns.map((name) => `\`${name}\``).join(', ')}.`
    : '- No generated / identity / sequence-backed columns were detected for exclusion in this scaffold.';
  const queryColumnsLine = params.queryColumns.length > 0
    ? `- Initial ${params.action} query columns: ${params.queryColumns.map((name) => `\`${name}\``).join(', ')}.`
    : `- Initial ${params.action} query does not require caller-visible write columns.`;
  const parameterColumnsLine = params.parameterColumns.length > 0
    ? `- Caller-supplied request/query params: ${params.parameterColumns.map((name) => `\`${name}\``).join(', ')}.`
    : '- No caller-supplied request/query params remain after applying scaffold defaults.';
  const defaultExpressionColumnsLine = params.action === 'insert' && params.defaultExpressionColumns.length > 0
    ? `- DDL-backed default expressions written directly into SQL: ${params.defaultExpressionColumns.map((name) => `\`${name}\``).join(', ')}.`
    : params.action === 'insert'
      ? '- No general insert columns used DDL-backed default expressions in this scaffold.'
      : `- DDL-backed default expressions are not applied in the baseline ${params.action} scaffold because the query writes caller-supplied values or a key-only predicate.`;

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
    '- `entryspec.ts`',
    `- \`${params.queryName}/queryspec.ts\``,
    `- \`${params.queryName}/${params.queryName}.sql\``,
    '- `tests/`',
    '- `README.md`',
    '',
    '## Shared helper files created by the CLI when missing',
    '',
    '- `src/features/_shared/featureQueryExecutor.ts`',
    '- `src/features/_shared/loadSqlResource.ts`',
    '- Cardinality runtime primitives from `@rawsql-ts/sql-contract`',
    '',
    '## AI-created files',
    '',
    `- \`tests/${params.featureName}.queryspec.test.ts\``,
    `- \`tests/${params.featureName}.feature.test.ts\``,
    '',
    '## Boundary responsibilities',
    '',
    '- `entryspec.ts` is the feature outer-boundary specification for request parsing, normalization, rejection, query-parameter assembly, and response shaping.',
    ...renderReadmeEntryspecNotes(params.action, params.parameterColumns),
    '- `entryspec.ts` keeps its schema values and helper functions file-local; it converts request data to query params explicitly and depends on the shared executor contract directly.',
    `- \`${params.queryName}/queryspec.ts\` is the DB-boundary specification for query params, row shape, query result shape, row-to-result mapping, and SQL execution contract.`,
    `- \`${params.queryName}/queryspec.ts\` keeps its \`zod\` schema values, row type, and helper functions private, completes params / row / result parsing internally, and depends on the shared executor contract directly.`,
    `- \`${params.queryName}/queryspec.ts\` and \`${params.queryName}/${params.queryName}.sql\` stay co-located as one queryspec/SQL pair.`,
    generatedColumnsLine,
    queryColumnsLine,
    parameterColumnsLine,
    defaultExpressionColumnsLine,
    ...renderReadmeOperationNotes(params.action, params.primaryKeyColumn),
    '',
    '## Query growth rule',
    '',
    `- When the feature grows beyond one query, add another sibling query directory next to \`${params.queryName}/\`.`,
    '- Keep each query directory self-contained with exactly one `queryspec.ts` and one SQL resource.',
    '- Add transport-specific adapters later only when a concrete transport contract exists.',
    '',
    '## Shared helper note',
    '',
    '- `src/features/_shared/featureQueryExecutor.ts` is the shared runtime contract for DB execution injection.',
    '- Cardinality execution should come from `@rawsql-ts/sql-contract` so the scaffold does not re-invent feature-local row-count helpers.',
    '- Treat `exactly-one`, `zero-or-one`, `many`, and `scalar` as the long-term cardinality contract family for future CRUD expansion.',
    '',
    '## Follow-up customization points',
    '',
    '- Narrow field types and validation rules once the transport contract is known.',
    '- Replace any scaffolded DDL-backed default expression if the feature needs a different explicit SQL assignment.',
    ...renderReadmeFollowUpNotes(params.action),
    '- Add QuerySpec and feature tests under `tests/` as the AI-owned follow-up step.',
    ''
  ].join('\n');
}

function renderReadmeEntryspecNotes(action: FeatureAction, parameterColumns: string[]): string[] {
  const hasStringLikeInput = parameterColumns.length > 0;
  if (action === 'delete') {
    return [
      '- `entryspec.ts` uses `zod` schemas for request and response DTOs and keeps the delete baseline focused on key-only request parsing.',
      '- The delete baseline does not assume string normalization; add transport-specific parsing or policy checks later only when the feature actually needs them.'
    ];
  }

  if (hasStringLikeInput) {
    return [
      '- `entryspec.ts` uses `zod` schemas for request and response DTOs, and the scaffold includes `trim()` plus empty-string rejection examples for current string inputs.'
    ];
  }

  return [
    '- `entryspec.ts` uses `zod` schemas for request and response DTOs and leaves string normalization examples for follow-up when string fields appear.'
  ];
}

function renderEntrySpecBoundaryComments(action: FeatureAction): string[] {
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

function renderZodObjectSchema(
  name: string,
  fields: RenderField[],
  options: { trimStrings: boolean; rejectEmptyStrings: boolean; exported: boolean }
): string {
  const lines = [`${options.exported ? 'export ' : ''}const ${name} = z.object({`];
  for (const field of fields) {
    lines.push(`  ${field.name}: ${renderZodField(field, options)},`);
  }
  lines.push('});');
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
