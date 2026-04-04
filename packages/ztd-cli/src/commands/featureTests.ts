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
  featureName: string;
  queryName: string;
  queryDir: string;
  testsDir: string;
  generatedDir: string;
  casesDir: string;
  entrypointFile: string;
  queryTypesFile: string;
  planFile: string;
  analysisFile: string;
  basicCaseFile: string;
  querySpecFile: string;
  querySqlFile: string;
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
  queryInputFields: string[];
  queryOutputFields: string[];
  queryFixtureRowFields: string[];
  querySpecSourcePath: string;
  entrySpecPath: string;
  querySpecPath: string;
  sqlPath: string;
  vitestEntrypointPath: string;
  generatedDirPath: string;
  casesDirPath: string;
  analysisPath: string;
  fixedVerifierPath: string;
}

export function registerFeatureTestsScaffoldCommand(featureCommand: Command): void {
  const tests = featureCommand
    .command('tests')
    .description('Refresh queryspec-owned ZTD analysis, the thin Vitest entrypoint, and persistent cases for AI and humans');

  tests
    .command('scaffold')
    .description('Refresh queryspec-owned ZTD analysis, the thin Vitest entrypoint, and keep persistent cases for AI and humans')
    .requiredOption('--feature <name>', 'Target feature name')
    .option('--query <name>', 'Target query directory when the feature has more than one query')
    .option('--dry-run', 'Validate inputs and emit the planned scaffold without writing files', false)
    .option('--force', 'Overwrite scaffold-owned generated files when they already exist', false)
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
        `- src/features/${result.featureName}/${result.queryName}/tests/${result.queryName}.queryspec.ztd.test.ts`,
        `- src/features/${result.featureName}/${result.queryName}/tests/queryspec-ztd-types.ts`,
        `- src/features/${result.featureName}/${result.queryName}/tests/generated/TEST_PLAN.md`,
        `- src/features/${result.featureName}/${result.queryName}/tests/generated/analysis.json`,
        `- AI-authored case files belong in src/features/${result.featureName}/${result.queryName}/tests/cases/`
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

  const queryLayout = resolveQueryLayout(featureDir, featureName, options.query);
  assertGeneratedWriteSafety([queryLayout.planFile, queryLayout.analysisFile], options.force === true);

  const planDetails = buildTestPlanDetails({
    rootDir,
    featureDir,
    queryLayout
  });

  const files = renderFeatureTestScaffoldFiles({
    featureName,
    queryName: queryLayout.queryName,
    planDetails
  });

  const outputs: FeatureTestsScaffoldResult['outputs'] = [
    { path: toProjectRelativePath(rootDir, queryLayout.testsDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, queryLayout.generatedDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, queryLayout.casesDir), written: !options.dryRun, kind: 'directory' },
    { path: toProjectRelativePath(rootDir, queryLayout.entrypointFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, queryLayout.basicCaseFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, queryLayout.queryTypesFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, queryLayout.planFile), written: !options.dryRun, kind: 'file' },
    { path: toProjectRelativePath(rootDir, queryLayout.analysisFile), written: !options.dryRun, kind: 'file' }
  ];

  if (options.dryRun) {
    return {
      featureName,
      queryName: queryLayout.queryName,
      dryRun: true,
      outputs
    };
  }

  ensureDirectory(queryLayout.testsDir);
  ensureDirectory(queryLayout.generatedDir);
  ensureDirectory(queryLayout.casesDir);

  // The Vitest entrypoint and the initial case file are created once and then
  // treated as persistent query-owned assets. `--force` only refreshes the
  // CLI-owned generated snapshot files below.
  writeFileIfMissing(queryLayout.entrypointFile, files.vitestEntrypointFile);
  writeFileIfMissing(queryLayout.basicCaseFile, files.basicCaseFile);
  writeFileIfMissing(queryLayout.queryTypesFile, files.queryTypesFile);
  writeFeatureFile(queryLayout.planFile, files.testPlanFile, options.force === true);
  writeFeatureFile(queryLayout.analysisFile, files.analysisFile, options.force === true);

  emitDiagnostic({
    code: 'feature-tests-scaffold.ai-follow-up',
    message: `CLI created src/features/${featureName}/${queryLayout.queryName}/tests/ only. Keep generated artifacts read-only, leave the Vitest entrypoint in place, and put AI-authored cases under src/features/${featureName}/${queryLayout.queryName}/tests/cases/.`
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
  planDetails: TestPlanDetails;
}): {
  testPlanFile: string;
  analysisFile: string;
  vitestEntrypointFile: string;
  basicCaseFile: string;
  queryTypesFile: string;
} {
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
    `# ${params.featureName} / ${params.queryName} queryspec test plan`,
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
    `- vitestEntrypoint: ${params.planDetails.vitestEntrypointPath}`,
    `- generatedDir: ${params.planDetails.generatedDirPath}`,
    `- casesDir: ${params.planDetails.casesDirPath}`,
    `- analysisJson: ${params.planDetails.analysisPath}`,
    '',
    '## Source Files',
    '',
    `- ${params.planDetails.entrySpecPath}`,
    `- ${params.planDetails.querySpecPath}`,
    `- ${params.planDetails.sqlPath}`,
    `- ${params.planDetails.vitestEntrypointPath}`,
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
    '## After DB Semantics',
    '',
    '- `afterDb` is optional and must be a pure fixture with schema-qualified table keys.',
    '- The harness compares post-execution rows exactly after normalizing object key order.',
    '- Row order is ignored, but row content must match exactly.',
    '- Use `afterDb` for full post-execution snapshots, not partial matches.',
    '',
    '## Ownership',
    '',
    `- Generated files live under ${params.planDetails.generatedDirPath}.`,
    `- AI-authored case files live under ${params.planDetails.casesDirPath}.`,
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

  const querySpecImportPath = '../queryspec.js';
  const harnessImportPath = '../../../../../tests/ztd/harness.js';
  const casesImportPath = './cases/basic.case.js';
  const executorName = readExportedFunctionName(params.planDetails.querySpecSourcePath, 'execute', 'QuerySpec');
  const queryTypePrefix = toPascalCase(params.queryName);
  const queryCaseTypeName = `${queryTypePrefix}QuerySpecZtdCase`;
  const queryTypesImportPath = './queryspec-ztd-types.js';
  const beforeDbTypeLiteral = buildQueryFixtureTypeLiteral(
    params.planDetails.fixtureCandidateTables,
    buildQueryFixtureRowTypeLiteral(params.planDetails.queryFixtureRowFields)
  );
  const afterDbTypeLiteral = params.planDetails.writesTables.length > 0
    ? buildQueryFixtureTypeLiteral(
        params.planDetails.writesTables,
        buildQueryFixtureRowTypeLiteral(params.planDetails.queryFixtureRowFields)
      )
    : beforeDbTypeLiteral;
  const beforeDbValueLiteral = buildQueryFixtureValueLiteral(params.planDetails.fixtureCandidateTables);
  const afterDbValueLiteral = params.planDetails.writesTables.length > 0
    ? buildQueryFixtureValueLiteral(params.planDetails.writesTables)
    : beforeDbValueLiteral;
  const queryInputTypeLiteral = buildRecordShapeTypeLiteral(params.planDetails.queryInputFields);
  const queryOutputTypeLiteral = buildRecordShapeTypeLiteral(params.planDetails.queryOutputFields);
  const vitestEntrypointFile = [
    `import { expect, test } from 'vitest';`,
    '',
    `import { runQuerySpecZtdCases } from '${harnessImportPath}';`,
    `import { ${executorName} } from '${querySpecImportPath}';`,
    `import cases from '${casesImportPath}';`,
    `import type { ${queryCaseTypeName} } from '${queryTypesImportPath}';`,
    '',
    `test('${params.featureName}/${params.queryName} queryspec ZTD cases run through the fixed app-level harness', async () => {`,
    '  expect(cases.length).toBeGreaterThan(0);',
    `  await runQuerySpecZtdCases(cases, ${executorName});`,
    '});',
    ''
  ].join('\n');

  const basicCaseFile = [
    `import type { ${queryTypePrefix}BeforeDb, ${queryTypePrefix}Input, ${queryTypePrefix}Output${params.planDetails.writesTables.length > 0 ? `, ${queryTypePrefix}AfterDb` : ''}, ${queryCaseTypeName} } from '../queryspec-ztd-types.js';`,
    '',
    `const cases: readonly ${queryCaseTypeName}[] = [`,
    '  {',
    "    name: 'basic-success',",
    `    beforeDb: ${beforeDbValueLiteral} as ${queryTypePrefix}BeforeDb,`,
    `    input: {} as ${queryTypePrefix}Input,`,
    `    output: {} as ${queryTypePrefix}Output,`,
    ...(params.planDetails.writesTables.length > 0
      ? [
          `    afterDb: ${afterDbValueLiteral} as ${queryTypePrefix}AfterDb,`
        ]
      : [
          '    // afterDb: {',
          '    //   // TODO: add post-execution DB expectations when the query mutates state.',
          '    // }'
        ]),
    '  }',
    '];',
    '',
    'export default cases;',
    ''
  ].join('\n');

  const queryTypesFile = [
    `import type { QuerySpecZtdCase } from '../../../../../tests/ztd/case-types.js';`,
    '',
    `export type ${queryTypePrefix}BeforeDb = ${beforeDbTypeLiteral};`,
    `export type ${queryTypePrefix}Input = ${queryInputTypeLiteral};`,
    `export type ${queryTypePrefix}Output = ${queryOutputTypeLiteral};`,
    `export type ${queryTypePrefix}AfterDb = ${afterDbTypeLiteral};`,
    '',
    `export type ${queryCaseTypeName} = QuerySpecZtdCase<`,
    `  ${queryTypePrefix}BeforeDb,`,
    `  ${queryTypePrefix}Input,`,
    `  ${queryTypePrefix}Output,`,
    `  ${queryTypePrefix}AfterDb`,
    '>;',
    ''
  ].join('\n');

  return {
    testPlanFile,
    analysisFile,
    vitestEntrypointFile,
    basicCaseFile,
    queryTypesFile
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
  const sqlSource = readFileSync(params.queryLayout.querySqlFile, 'utf8');
  const requestFields = extractSchemaFields(entrySpecSource, 'RequestSchema');
  const queryInputFields = extractSchemaFields(querySpecSource, 'QueryParamsSchema');
  const queryOutputFields = extractSchemaFields(querySpecSource, 'QueryResultSchema');
  const sqlInsertColumns = extractSqlInsertColumns(sqlSource);
  const sqlReturningColumns = extractSqlReturningColumns(sqlSource);
  const fixtureCandidateTables = dedupeStrings([
    ...extractSqlTableReferences(sqlSource),
    ...extractSqlWriteTables(sqlSource)
  ]);
  const writesTables = extractSqlWriteTables(sqlSource);
  const resultCardinality = querySpecSource.includes('items: z.array(') || params.queryLayout.queryName === 'list' ? 'many' : 'one';
  const resolvedInputFields = queryInputFields.length > 0 ? queryInputFields : requestFields;
  const resolvedOutputFields = queryOutputFields.length > 0 ? queryOutputFields : sqlReturningColumns;

  return {
    schemaVersion: 1,
    featureId: path.basename(params.featureDir),
    testKind: 'ztd',
    fixtureCandidateTables,
    writesTables,
    validationScenarioHints: buildValidationScenarioHints(requestFields, params.queryLayout.queryName),
    dbScenarioHints: buildDbScenarioHints(writesTables, params.queryLayout.queryName, fixtureCandidateTables),
    resultCardinality,
    queryInputFields: resolvedInputFields,
    queryOutputFields: resolvedOutputFields,
    queryFixtureRowFields: dedupeStrings([...sqlInsertColumns, ...sqlReturningColumns, ...resolvedOutputFields]),
    entrySpecPath: toProjectRelativePath(params.rootDir, entrySpecFile),
    querySpecSourcePath: params.queryLayout.querySpecFile,
    querySpecPath: toProjectRelativePath(params.rootDir, params.queryLayout.querySpecFile),
    sqlPath: toProjectRelativePath(params.rootDir, params.queryLayout.querySqlFile),
    vitestEntrypointPath: toProjectRelativePath(params.rootDir, params.queryLayout.entrypointFile),
    generatedDirPath: toProjectRelativePath(params.rootDir, params.queryLayout.generatedDir),
    casesDirPath: toProjectRelativePath(params.rootDir, params.queryLayout.casesDir),
    analysisPath: toProjectRelativePath(params.rootDir, params.queryLayout.analysisFile),
    fixedVerifierPath: 'tests/ztd/harness.ts'
  };
}

function buildValidationScenarioHints(requestFields: string[], queryName: string): string[] {
  const hints = [
    'Keep entryspec validation separate from queryspec DB-backed execution.',
    'Validation failures belong in the feature-root mock test lane.'
  ];

  if (requestFields.length > 0) {
    hints.push(`Required request fields in entryspec: ${requestFields.map((field) => `\`${field}\``).join(', ')}.`);
  } else {
    hints.push(`No required request fields were extracted for ${queryName}; keep the entryspec test focused on normalization and boundary rules.`);
  }

  return hints;
}

function buildDbScenarioHints(writesTables: string[], queryName: string, fixtureCandidateTables: string[]): string[] {
  const hints = [
    'Use the fixed app-level harness and query-local cases to keep the ZTD path thin.',
    'Keep db/input/output visible in the case file so the AI can fill the query contract without re-deriving the scaffold.'
  ];

  if (writesTables.length > 0) {
    hints.push(`Write tables for ${queryName}: ${writesTables.map((table) => `\`${table}\``).join(', ')}.`);
    hints.push('Add afterDb when the query mutates state and you need to assert the post-execution table snapshot.');
  } else if (fixtureCandidateTables.length > 0) {
    hints.push(`Read tables for ${queryName}: ${fixtureCandidateTables.map((table) => `\`${table}\``).join(', ')}.`);
    hints.push('DB-backed cases should seed the minimum fixture rows needed to make the query result shape obvious.');
  } else {
    hints.push(`No table references were discovered for ${queryName}; inspect SQL and QuerySpec manually before filling the case.`);
  }

  return hints;
}

type FixtureTreeNode = {
  children: Map<string, FixtureTreeNode>;
};

function buildFixtureTree(tableNames: string[]): FixtureTreeNode {
  const root: FixtureTreeNode = { children: new Map() };

  for (const tableName of dedupeStrings(tableNames)) {
    const segments = tableName
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);

    let current = root;
    for (const segment of segments) {
      if (!current.children.has(segment)) {
        current.children.set(segment, { children: new Map() });
      }
      current = current.children.get(segment)!;
    }
  }

  return root;
}

function renderFixtureTree(node: FixtureTreeNode, leaf: string, separator: ',' | ';'): string {
  if (node.children.size === 0) {
    return leaf;
  }

  const entries = [...node.children.entries()].map(([segment, child]) => `${segment}: ${renderFixtureTree(child, leaf, separator)}`);
  return `{ ${entries.join(` ${separator} `)} }`;
}

function buildQueryFixtureTypeLiteral(tableNames: string[], rowTypeLiteral: string): string {
  const normalized = dedupeStrings(tableNames);
  if (normalized.length === 0) {
    return 'Record<string, never>';
  }
  return renderFixtureTree(buildFixtureTree(normalized), `readonly ${rowTypeLiteral}[]`, ';');
}

function buildQueryFixtureRowTypeLiteral(fieldNames: string[]): string {
  const normalized = dedupeStrings(fieldNames);
  if (normalized.length === 0) {
    return 'Record<string, unknown>';
  }

  return `{ ${normalized.map((field) => `${field}?: unknown`).join('; ')} }`;
}

function buildRecordShapeTypeLiteral(fieldNames: string[]): string {
  const normalized = dedupeStrings(fieldNames);
  if (normalized.length === 0) {
    return 'Record<string, unknown>';
  }

  return `{ ${normalized.map((field) => `${field}: unknown`).join('; ')} }`;
}

function buildQueryFixtureValueLiteral(tableNames: string[]): string {
  const normalized = dedupeStrings(tableNames);
  if (normalized.length === 0) {
    return '{}';
  }
  return renderFixtureTree(buildFixtureTree(normalized), '[]', ',');
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

function extractSqlInsertColumns(sqlSource: string): string[] {
  const match = sqlSource.match(/\binsert\s+into\s+[^\s(,;]+(?:\s*\(\s*([^)]+?)\s*\))?/i);
  if (!match || !match[1]) {
    return [];
  }

  return splitSqlIdentifiers(match[1]);
}

function extractSqlReturningColumns(sqlSource: string): string[] {
  const match = sqlSource.match(/\breturning\s+([^;]+)$/i);
  if (!match || !match[1]) {
    return [];
  }

  return splitSqlIdentifiers(match[1]);
}

function splitSqlIdentifiers(value: string): string[] {
  return value
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/^["'`]|["'`]$/g, ''))
    .map((segment) => segment.replace(/\s+as\s+.+$/i, ''))
    .map((segment) => segment.replace(/\(.+\)$/, ''))
    .map((segment) => segment.trim())
    .filter(Boolean);
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

function normalizeSqlTableName(value: string): string {
  return value
    .trim()
    .replace(/;$/, '')
    .split('.')
    .map((segment) => segment.replace(/^["'`]|["'`]$/g, '').toLowerCase())
    .join('.');
}

function resolveQueryLayout(featureDir: string, featureName: string, selectedQueryName?: string): QueryLayout {
  const queryDirectories = readdirSync(featureDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((entry) => existsSync(path.join(featureDir, entry, 'queryspec.ts')))
    .sort((a, b) => a.localeCompare(b));

  if (selectedQueryName) {
    if (!queryDirectories.includes(selectedQueryName)) {
      throw new Error(`Query directory not found for tests scaffold: ${selectedQueryName}.`);
    }
    return buildQueryLayout(featureDir, featureName, selectedQueryName);
  }

  if (queryDirectories.length === 0) {
    throw new Error(`No queryspec.ts file was discovered under ${featureDir}. Run feature scaffold first.`);
  }

  if (queryDirectories.length > 1) {
    throw new Error(`Multiple query directories were discovered under ${featureDir}. Re-run with --query <name>.`);
  }

  return buildQueryLayout(featureDir, featureName, queryDirectories[0]);
}

function buildQueryLayout(featureDir: string, featureName: string, queryName: string): QueryLayout {
  const queryDir = path.join(featureDir, queryName);
  const testsDir = path.join(queryDir, 'tests');
  const generatedDir = path.join(testsDir, 'generated');
  const casesDir = path.join(testsDir, 'cases');
  return {
    featureName,
    queryName,
    queryDir,
    testsDir,
    generatedDir,
    casesDir,
    entrypointFile: path.join(testsDir, `${queryName}.queryspec.ztd.test.ts`),
    queryTypesFile: path.join(testsDir, 'queryspec-ztd-types.ts'),
    planFile: path.join(generatedDir, 'TEST_PLAN.md'),
    analysisFile: path.join(generatedDir, 'analysis.json'),
    basicCaseFile: path.join(casesDir, 'basic.case.ts'),
    querySpecFile: path.join(queryDir, 'queryspec.ts'),
    querySqlFile: path.join(queryDir, `${queryName}.sql`)
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

function assertGeneratedWriteSafety(paths: string[], force: boolean): void {
  if (force) {
    return;
  }

  const existingPaths = paths.filter((candidate) => existsSync(candidate));
  if (existingPaths.length === 0) {
    return;
  }

  throw new Error(
    `Refusing to overwrite queryspec-generated feature test scaffold files without --force: ${existingPaths.map(normalizeCliPath).join(', ')}`
  );
}

function writeFeatureFile(filePath: string, contents: string, force: boolean): void {
  if (existsSync(filePath) && !force) {
    return;
  }
  writeFileSync(filePath, contents, 'utf8');
}

function writeFileIfMissing(filePath: string, contents: string): void {
  if (existsSync(filePath)) {
    return;
  }
  writeFileSync(filePath, contents, 'utf8');
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}
