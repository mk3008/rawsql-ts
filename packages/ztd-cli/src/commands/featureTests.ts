import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';

import { emitDiagnostic, isJsonOutput, writeCommandEnvelope } from '../utils/agentCli';
import { ensureDirectory } from '../utils/fs';

type FeatureTestsCommandOptions = {
  feature?: string;
  query?: string;
  dryRun?: boolean;
  force?: boolean;
  rootDir?: string;
};

interface FeatureTestsScaffoldResult {
  featureName: string;
  queryName: string;
  dryRun: boolean;
  outputs: Array<{ path: string; written: boolean; kind: 'directory' | 'file' }>;
}

interface QueryLayout {
  queryName: string;
  querySpecFile: string;
  sqlFile: string;
}

interface FeatureTestAnalysis {
  schemaVersion: 1;
  featureId: string;
  testKind: 'ztd';
  fixtureCandidateTables: string[];
  writesTables: string[];
  validationScenarioHints: string[];
  dbScenarioHints: string[];
  resultCardinality: 'one' | 'many';
}

interface TestPlanDetails extends FeatureTestAnalysis {
  featureEntrySpecPath: string;
  querySpecPath: string;
  sqlPath: string;
  fixedVerifierPath: string;
  persistentCasesPath: string;
}

export function registerFeatureTestsScaffoldCommand(featureCommand: Command): void {
  const tests = featureCommand
    .command('tests')
    .description('Refresh generated ZTD analysis and keep persistent cases for AI and humans');

  tests
    .command('scaffold')
    .description('Refresh generated ZTD analysis and keep persistent cases for AI and humans')
    .requiredOption('--feature <name>', 'Target feature name')
    .option('--query <name>', 'Target query directory when the feature has more than one query')
    .option('--dry-run', 'Validate inputs and emit the planned scaffold without writing files', false)
    .option('--force', 'Overwrite scaffold-owned test files when they already exist', false)
    .action(async (options: FeatureTestsCommandOptions) => {
      const result = await runFeatureTestsScaffoldCommand(options);
      if (isJsonOutput()) {
        writeCommandEnvelope('feature tests scaffold', result);
        return;
      }

      const lines = [
        `Feature tests scaffold ${result.dryRun ? 'plan' : 'completed'}: ${result.featureName}`,
        `Query: ${result.queryName}`,
        '',
        'Created by CLI:',
        ...result.outputs.map((output) => `- ${output.path}`),
        '',
        'Reserved for AI follow-up:',
        `- src/features/${result.featureName}/tests/ztd/generated/TEST_PLAN.md`,
        `- src/features/${result.featureName}/tests/ztd/generated/analysis.json`,
        `- AI-authored case files belong in src/features/${result.featureName}/tests/ztd/cases/`
      ];
      process.stdout.write(`${lines.join('\n')}\n`);
    });
}

export async function runFeatureTestsScaffoldCommand(options: FeatureTestsCommandOptions): Promise<FeatureTestsScaffoldResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const featureName = normalizeFeatureName(options.feature ?? '');
  const featureDir = path.join(rootDir, 'src', 'features', featureName);
  if (!existsSync(featureDir)) {
    throw new Error(`Feature not found for tests scaffold: ${featureName}. Run feature scaffold first.`);
  }

  const queryLayout = resolveQueryLayout(featureDir, options.query);
  const testsDir = path.join(featureDir, 'tests');
  const ztdDir = path.join(testsDir, 'ztd');
  const generatedDir = path.join(ztdDir, 'generated');
  const casesDir = path.join(ztdDir, 'cases');
  const planFile = path.join(generatedDir, 'TEST_PLAN.md');
  const analysisFile = path.join(generatedDir, 'analysis.json');

  assertTestWriteSafety([planFile, analysisFile], options.force === true);

  const outputs: FeatureTestsScaffoldResult['outputs'] = [
    { path: toProjectRelativePath(rootDir, testsDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, ztdDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, generatedDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, casesDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, planFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, analysisFile), written: !options.dryRun, kind: 'file' }
  ];

  const planDetails = buildTestPlanDetails({
    rootDir,
    featureDir,
    queryLayout
  });
  const files = renderFeatureTestScaffoldFiles({
    featureName,
    queryName: queryLayout.queryName,
    testPlanPath: toProjectRelativePath(rootDir, planFile),
    analysisPath: toProjectRelativePath(rootDir, analysisFile),
    planDetails
  });

  if (options.dryRun) {
    return {
      featureName,
      queryName: queryLayout.queryName,
      dryRun: true,
      outputs
    };
  }

  ensureDirectory(testsDir);
  ensureDirectory(ztdDir);
  ensureDirectory(generatedDir);
  ensureDirectory(casesDir);
  writeFeatureFile(planFile, files.testPlanFile, options.force === true);
  writeFeatureFile(analysisFile, files.analysisFile, options.force === true);

  emitDiagnostic({
    code: 'feature-tests-scaffold.ai-follow-up',
    message: `CLI created src/features/${featureName}/tests/ztd/generated/ only. Keep generated artifacts read-only and put AI-authored cases under src/features/${featureName}/tests/ztd/cases/.`
  });

  return {
    featureName,
    queryName: queryLayout.queryName,
    dryRun: false,
    outputs
  };
}

function renderFeatureTestScaffoldFiles(params: {
  featureName: string;
  queryName: string;
  testPlanPath: string;
  analysisPath: string;
  planDetails: TestPlanDetails;
}): { testPlanFile: string; analysisFile: string } {
  const fixtureCandidateTablesLine = params.planDetails.fixtureCandidateTables.length > 0
    ? params.planDetails.fixtureCandidateTables.map((field) => `- ${field}`).join('\n')
    : '- TODO: inspect the scaffolded SQL and DDL for fixture candidate tables.';
  const writesTablesLine = params.planDetails.writesTables.length > 0
    ? params.planDetails.writesTables.map((field) => `- ${field}`).join('\n')
    : '- TODO: inspect the scaffolded SQL for write targets.';
  const validationHintsLine = params.planDetails.validationScenarioHints.length > 0
    ? params.planDetails.validationScenarioHints.map((field) => `- ${field}`).join('\n')
    : '- TODO: inspect the scaffolded entryspec.ts for validation hints.';
  const dbHintsLine = params.planDetails.dbScenarioHints.length > 0
    ? params.planDetails.dbScenarioHints.map((field) => `- ${field}`).join('\n')
    : '- TODO: inspect the scaffolded QuerySpec and SQL for DB-backed hints.';
  const testPlanFile = [
    `# ${params.featureName} test plan`,
    '',
    'This file snapshots the current scaffold contract before AI adds case files.',
    '',
    '## Contract Snapshot',
    '',
    `- schemaVersion: ${params.planDetails.schemaVersion}`,
    `- featureId: ${params.planDetails.featureId}`,
    `- testKind: ${params.planDetails.testKind}`,
    `- resultCardinality: ${params.planDetails.resultCardinality}`,
    `- fixedVerifier: ${params.planDetails.fixedVerifierPath}`,
    `- persistentCases: ${params.planDetails.persistentCasesPath}`,
    `- analysisJson: ${params.analysisPath}`,
    '',
    '## Source Files',
    '',
    `- ${params.planDetails.featureEntrySpecPath}`,
    `- ${params.planDetails.querySpecPath}`,
    `- ${params.planDetails.sqlPath}`,
    '',
    '## Fixture Candidate Tables',
    '',
    fixtureCandidateTablesLine,
    '',
    '## Write Tables',
    '',
    writesTablesLine,
    '',
    '## Validation Scenario Hints',
    '',
    validationHintsLine,
    '',
    '## DB Scenario Hints',
    '',
    dbHintsLine,
    '',
    '## Ownership',
    '',
    `- Generated files live under ${params.planDetails.persistentCasesPath.replace(/\/[^/]+$/, '/generated/')}.`,
    `- AI-authored case files live under ${params.planDetails.persistentCasesPath}.`,
    '- Do not edit generated files by hand unless you are intentionally repairing them with --force.',
    ''
  ].join('\n');

  const analysisFile = `${JSON.stringify(
    {
      schemaVersion: params.planDetails.schemaVersion,
      featureId: params.planDetails.featureId,
      testKind: params.planDetails.testKind,
      fixtureCandidateTables: params.planDetails.fixtureCandidateTables,
      writesTables: params.planDetails.writesTables,
      validationScenarioHints: params.planDetails.validationScenarioHints,
      dbScenarioHints: params.planDetails.dbScenarioHints,
      resultCardinality: params.planDetails.resultCardinality
    },
    null,
    2
  )}\n`;

  return {
    testPlanFile,
    analysisFile
  };
}

function buildTestPlanDetails(params: {
  rootDir: string;
  featureDir: string;
  queryLayout: QueryLayout;
}): TestPlanDetails {
  const entrySpecFile = path.join(params.featureDir, 'entryspec.ts');
  const entrySpecSource = readFileSync(entrySpecFile, 'utf8');
  const querySpecSource = readFileSync(params.queryLayout.querySpecFile, 'utf8');
  const sqlSource = readFileSync(params.queryLayout.sqlFile, 'utf8');
  const analysis = buildFeatureTestAnalysis({
    featureId: path.basename(params.featureDir),
    queryName: params.queryLayout.queryName,
    entrySpecSource,
    querySpecSource,
    sqlSource
  });

  return {
    ...analysis,
    featureEntrySpecPath: toProjectRelativePath(params.rootDir, entrySpecFile),
    querySpecPath: toProjectRelativePath(params.rootDir, params.queryLayout.querySpecFile),
    sqlPath: toProjectRelativePath(params.rootDir, params.queryLayout.sqlFile),
    fixedVerifierPath: 'tests/ztd/harness.ts',
    persistentCasesPath: `src/features/${path.basename(params.featureDir)}/tests/ztd/cases`
  };
}

function buildFeatureTestAnalysis(params: {
  featureId: string;
  queryName: string;
  entrySpecSource: string;
  querySpecSource: string;
  sqlSource: string;
}): FeatureTestAnalysis {
  const tables = dedupeStrings([
    ...extractSqlTableReferences(params.sqlSource),
    ...extractSqlWriteTables(params.sqlSource)
  ]);
  const resultCardinality: 'one' | 'many' = params.queryName.toLowerCase().includes('list') ? 'many' : 'one';
  const validationScenarioHints = [
    'Missing required request fields should fail at the feature boundary.',
    'Malformed feature input should never reach the fixed verifier.'
  ];
  const dbScenarioHints = [
    'Keep the success path DB-backed through the fixed app-level verifier.',
    resultCardinality === 'many'
      ? 'Expect multiple rows for list-style results.'
      : 'Expect one row or one inserted result for a non-list feature.'
  ];

  return {
    schemaVersion: 1,
    featureId: params.featureId,
    testKind: 'ztd',
    fixtureCandidateTables: tables,
    writesTables: extractSqlWriteTables(params.sqlSource),
    validationScenarioHints,
    dbScenarioHints,
    resultCardinality
  };
}

function extractSqlTableReferences(sqlSource: string): string[] {
  const tablePatterns = [
    /\binsert\s+into\s+([^\s(,;]+)/ig,
    /\bupdate\s+([^\s(,;]+)/ig,
    /\bdelete\s+from\s+([^\s(,;]+)/ig,
    /\bfrom\s+([^\s(,;]+)/ig,
    /\bjoin\s+([^\s(,;]+)/ig
  ];
  const tables = new Set<string>();

  for (const pattern of tablePatterns) {
    for (const match of sqlSource.matchAll(pattern)) {
      const tableName = match[1];
      if (tableName) {
        tables.add(normalizeSqlTableName(tableName));
      }
    }
  }

  return [...tables];
}

function extractSqlWriteTables(sqlSource: string): string[] {
  const writePatterns = [
    /\binsert\s+into\s+([^\s(,;]+)/ig,
    /\bupdate\s+([^\s(,;]+)/ig,
    /\bdelete\s+from\s+([^\s(,;]+)/ig
  ];
  const tables = new Set<string>();

  for (const pattern of writePatterns) {
    for (const match of sqlSource.matchAll(pattern)) {
      const tableName = match[1];
      if (tableName) {
        tables.add(normalizeSqlTableName(tableName));
      }
    }
  }

  return [...tables];
}

function normalizeSqlTableName(value: string): string {
  return value
    .trim()
    .replace(/;$/, '')
    .split('.')
    .map((segment) => segment.replace(/^["'`]|["'`]$/g, '').toLowerCase())
    .join('.');
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function extractSchemaFields(source: string, schemaName: string): string[] {
  const match = source.match(new RegExp(`const\\s+${schemaName}\\s*=\\s*z\\.object\\(\\{([\\s\\S]*?)\\}\\)\\.strict\\(\\);`));
  if (!match) {
    return [];
  }

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/,$/, ''))
    .map((line) => line.match(/^([a-zA-Z0-9_]+):/)?.[1])
    .filter((value): value is string => Boolean(value));
}

function extractReturningColumns(sqlSource: string): string[] {
  const match = sqlSource.match(/returning\s+(.+?);/is);
  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((value) => value.trim())
    .map((value) => value.replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function resolveQueryLayout(featureDir: string, selectedQueryName?: string): QueryLayout {
  const queryDirectories = readdirSync(featureDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((entry) => existsSync(path.join(featureDir, entry, 'queryspec.ts')))
    .sort((a, b) => a.localeCompare(b));

  if (selectedQueryName) {
    if (!queryDirectories.includes(selectedQueryName)) {
      throw new Error(`Query directory not found for tests scaffold: ${selectedQueryName}.`);
    }
    return buildQueryLayout(featureDir, selectedQueryName);
  }

  if (queryDirectories.length === 0) {
    throw new Error(`No queryspec.ts file was discovered under ${featureDir}. Run feature scaffold first.`);
  }

  if (queryDirectories.length > 1) {
    throw new Error(`Multiple query directories were discovered under ${featureDir}. Re-run with --query <name>.`);
  }

  return buildQueryLayout(featureDir, queryDirectories[0]);
}

function buildQueryLayout(featureDir: string, queryName: string): QueryLayout {
  return {
    queryName,
    querySpecFile: path.join(featureDir, queryName, 'queryspec.ts'),
    sqlFile: path.join(featureDir, queryName, `${queryName}.sql`)
  };
}

function normalizeFeatureName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(normalized)) {
    throw new Error('Feature name must use resource-action kebab-case, start with a letter, and look like users-insert.');
  }
  return normalized;
}

function readExportedFunctionName(filePath: string, prefix: string, suffix: string): string {
  const contents = readFileSync(filePath, 'utf8');
  const match = contents.match(new RegExp(`export\\s+(?:async\\s+)?function\\s+(${prefix}[A-Za-z0-9]+${suffix})`));
  if (match) {
    return match[1];
  }
  const baseName = path.basename(filePath, path.extname(filePath));
  return `${prefix}${toPascalCase(baseName)}${suffix}`;
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function toProjectRelativePath(fromPath: string, toPath: string): string {
  return normalizeCliPath(path.relative(fromPath, toPath));
}

function normalizeCliPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function assertTestWriteSafety(paths: string[], force: boolean): void {
  if (force) {
    return;
  }

  const existingPaths = paths.filter((candidate) => existsSync(candidate));
  if (existingPaths.length === 0) {
    return;
  }

  throw new Error(
    `Refusing to overwrite feature test scaffold files without --force: ${existingPaths.map(normalizeCliPath).join(', ')}`
  );
}

function writeFeatureFile(filePath: string, contents: string, force: boolean): void {
  if (existsSync(filePath) && !force) {
    return;
  }
  writeFileSync(filePath, contents, 'utf8');
}
