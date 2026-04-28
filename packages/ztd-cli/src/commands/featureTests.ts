import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';

import { emitDiagnostic, isJsonOutput, writeCommandEnvelope } from '../utils/agentCli';
import { ensureDirectory } from '../utils/fs';
import { inspectImportAliasSupport } from '../utils/importAliasSupport';

const TESTS_SUPPORT_HARNESS_IMPORT_PATH = '#tests/support/ztd/harness.js';
const TESTS_SUPPORT_CASE_TYPES_IMPORT_PATH = '#tests/support/ztd/case-types.js';
const FEATURE_TEST_KINDS = ['ztd', 'traditional'] as const;
type FeatureTestKind = (typeof FEATURE_TEST_KINDS)[number];

type FeatureTestsCommandOptions = {
  feature?: string;
  query?: string;
  testKind?: string;
  dryRun?: boolean;
  force?: boolean;
  rootDir?: string;
};

interface FeatureTestsScaffoldResult {
  featureName: string;
  queryName: string;
  testKind: FeatureTestKind;
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
  testKind: FeatureTestKind;
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
    .description('Refresh query-boundary generated analysis, refresh the generated type file, and create the thin Vitest entrypoint when it is missing');

  tests
    .command('scaffold')
    .description('Refresh query-boundary generated analysis, refresh the generated type file, and keep persistent case files untouched')
    .requiredOption('--feature <name>', 'Target feature name')
    .option('--query <name>', 'Target query directory when the feature has more than one query')
    .option('--test-kind <kind>', 'Scaffold lane kind (ztd or traditional)', 'ztd')
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
        `Test kind: ${result.testKind}`,
        '',
        'Created by CLI:',
        ...result.outputs.map((output) => `- ${output.path}`),
        '',
        'CLI-owned generated files:',
        `- src/features/${result.featureName}/queries/${result.queryName}/tests/${result.queryName}.boundary.${result.testKind}.test.ts (created only when missing)`,
        `- src/features/${result.featureName}/queries/${result.queryName}/tests/boundary-${result.testKind}-types.ts`,
        `- src/features/${result.featureName}/queries/${result.queryName}/tests/generated/${result.testKind === 'ztd' ? 'TEST_PLAN.md' : 'TEST_PLAN.traditional.md'}`,
        `- src/features/${result.featureName}/queries/${result.queryName}/tests/generated/${result.testKind === 'ztd' ? 'analysis.json' : 'analysis.traditional.json'}`,
        '',
        'AI-authored files:',
        `- src/features/${result.featureName}/queries/${result.queryName}/tests/cases/ (${result.testKind === 'ztd' ? 'TODO-based cases; fill them before enabling the generated test' : 'TODO-based cases for the future traditional runner'})`
      ];
      process.stdout.write(`${lines.join('\n')}\n`);
    });
}

export async function runFeatureTestsScaffoldCommand(options: FeatureTestsCommandOptions): Promise<FeatureTestsScaffoldResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const testKind = normalizeFeatureTestKind(options.testKind);
  const featureName = normalizeFeatureName(options.feature ?? '');
  const featureDir = path.join(rootDir, 'src', 'features', featureName);
  if (!existsSync(featureDir)) {
    throw new Error(`Feature not found for tests scaffold: ${featureName}. Run feature scaffold first.`);
  }

  const queryLayout = resolveQueryLayout(featureDir, featureName, options.query, testKind);
  if (testKind === 'ztd') {
    assertSharedZtdTestSupport(rootDir);
  }
  assertGeneratedWriteSafety([queryLayout.planFile, queryLayout.analysisFile], options.force === true);

  const planDetails = buildTestPlanDetails({
    rootDir,
    featureDir,
    queryLayout,
    testKind
  });

  const files = renderFeatureTestScaffoldFiles({
    rootDir,
    featureName,
    queryName: queryLayout.queryName,
    planDetails,
    testKind
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
      testKind,
      dryRun: true,
      outputs
    };
  }

  ensureDirectory(queryLayout.testsDir);
  ensureDirectory(queryLayout.generatedDir);
  ensureDirectory(queryLayout.casesDir);

  // The Vitest entrypoint and the initial case file are created once and then
  // treated as persistent query-owned assets. `--force` refreshes the CLI-owned
  // generated snapshot files and the query-local type alias file below.
  writeFileIfMissing(queryLayout.entrypointFile, files.vitestEntrypointFile);
  writeFileIfMissing(queryLayout.basicCaseFile, files.basicCaseFile);
  writeFeatureFile(queryLayout.queryTypesFile, files.queryTypesFile, options.force === true);
  writeFeatureFile(queryLayout.planFile, files.testPlanFile, options.force === true);
  writeFeatureFile(queryLayout.analysisFile, files.analysisFile, options.force === true);

  emitDiagnostic({
    code: 'feature-tests-scaffold.ai-follow-up',
    message: testKind === 'ztd'
      ? `CLI refreshed generated analysis under src/features/${featureName}/queries/${queryLayout.queryName}/tests/generated/ for test-kind=${testKind}, refreshed boundary-${testKind}-types.ts, created the skipped Vitest entrypoint only if it was missing, and left TODO-based AI-authored cases under src/features/${featureName}/queries/${queryLayout.queryName}/tests/cases/ untouched. Fill the case values, then enable the generated test.`
      : `CLI refreshed generated analysis under src/features/${featureName}/queries/${queryLayout.queryName}/tests/generated/ for test-kind=${testKind}, refreshed boundary-${testKind}-types.ts, created the skipped Vitest entrypoint only if it was missing, and left TODO-based AI-authored cases under src/features/${featureName}/queries/${queryLayout.queryName}/tests/cases/ untouched. Keep this lane skipped until the traditional runner is wired.`
  });

  return {
    featureName,
    queryName: queryLayout.queryName,
    testKind,
    dryRun: false,
    outputs
  };
}

function assertSharedZtdTestSupport(rootDir: string): void {
  const requiredSupportFiles = [
    path.join(rootDir, 'tests', 'support', 'ztd', 'harness.ts'),
    path.join(rootDir, 'tests', 'support', 'ztd', 'case-types.ts')
  ];

  const missingFiles = requiredSupportFiles.filter((filePath) => !existsSync(filePath));
  if (missingFiles.length === 0) {
    return;
  }

  const missingList = missingFiles
    .map((filePath) => toProjectRelativePath(rootDir, filePath))
    .join(', ');

  throw new Error(
    `feature tests scaffold requires starter-owned shared ZTD support under tests/support/ztd. Missing: ${missingList}. Run \`ztd init --starter\` for a fresh starter project, or add the shared support files before scaffolding query-boundary tests.`
  );
}

function renderFeatureTestScaffoldFiles(params: {
  rootDir: string;
  featureName: string;
  queryName: string;
  planDetails: TestPlanDetails;
  testKind: FeatureTestKind;
}): {
  testPlanFile: string;
  analysisFile: string;
  vitestEntrypointFile: string;
  basicCaseFile: string;
  queryTypesFile: string;
} {
  const importAliasSupport = inspectImportAliasSupport(params.rootDir, {
    packageImportKey: '#tests/*.js',
    tsconfigPathKey: '#tests/*',
    vitestAliasPrefix: '#tests'
  });
  if (importAliasSupport === 'partial') {
    throw new Error(
      'Feature tests scaffold found partial #tests alias configuration. Configure package.json#imports, tsconfig.json compilerOptions.paths, and vitest.config.ts resolve.alias together, or remove the partial alias setup.'
    );
  }
  const useStableTestSupportImports = importAliasSupport === 'supported';
  const isZtdLane = params.testKind === 'ztd';
  const fixtureCandidateTablesLine = params.planDetails.fixtureCandidateTables.length > 0
    ? params.planDetails.fixtureCandidateTables.map((field) => `- ${field}`).join('\n')
    : '- TODO: inspect the scaffolded SQL and DDL for fixture candidate tables.';
  const writesTablesLine = params.planDetails.writesTables.length > 0
    ? params.planDetails.writesTables.map((field) => `- ${field}`).join('\n')
    : '- TODO: inspect the scaffolded SQL for write targets.';
  const validationHintsLine = params.planDetails.validationScenarioHints.length > 0
    ? params.planDetails.validationScenarioHints.map((field) => `- ${field}`).join('\n')
    : '- TODO: inspect the scaffolded boundary.ts for feature-boundary hints.';
  const dbHintsLine = params.planDetails.dbScenarioHints.length > 0
    ? params.planDetails.dbScenarioHints.map((field) => `- ${field}`).join('\n')
    : '- TODO: inspect the scaffolded query boundary and SQL for DB-backed hints.';
  const caseReadinessLine = isZtdLane
    ? '- Generated ZTD cases are intentionally placeholders. Fill `beforeDb`, `input`, and `output`, then change the generated Vitest entrypoint from `test.skip` to `test`.'
    : '- Generated traditional cases are intentionally placeholders until the traditional runner is wired.';

  const testPlanFile = [
    `# ${params.featureName} / ${params.queryName} boundary test plan`,
    '',
    'This file snapshots the current scaffold contract before AI completes the TODO-based case files.',
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
    '## Case Readiness',
    '',
    caseReadinessLine,
    '',
    '## After DB Semantics',
    '',
    ...(isZtdLane
      ? [
        '- ZTD queryspec execution is fixture-rewrite based and does not perform physical DB setup.',
        '- `mode=ztd`, `physicalSetupUsed=false`, and `rewriteApplied` are returned as machine-checkable evidence.',
        '- This ZTD lane does not expose `afterDb`; use output assertions or a traditional DB-state lane for post-state checks.',
        '- Set `ZTD_SQL_TRACE=1` to emit per-case SQL trace JSON; optionally set `ZTD_SQL_TRACE_DIR` to override the output directory.'
      ]
      : [
        '- Traditional lane should execute against physical DB state and keep evidence lane-tagged as `mode=traditional`.',
        '- Post-state assertions can be modeled in this lane (for example migration/index/physical-state effects).',
        '- Generated scaffold stays thin and must delegate mode behavior to library APIs instead of re-implementing lifecycle logic.',
        '- Use this scaffold as a follow-up wiring point while preserving query-local case ownership.'
      ]),
    '',
    '## Ownership',
    '',
    `- Generated files live under ${params.planDetails.generatedDirPath}.`,
    `- AI-authored TODO case files live under ${params.planDetails.casesDirPath}.`,
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

  const querySpecImportPath = '../boundary.js';
  const harnessImportPath = useStableTestSupportImports
    ? TESTS_SUPPORT_HARNESS_IMPORT_PATH
    : '../../../../../../tests/support/ztd/harness.js';
  const casesImportPath = isZtdLane ? './cases/basic.case.js' : './cases/basic.traditional.case.js';
  const executorName = readExportedFunctionName(params.planDetails.querySpecSourcePath, 'execute', 'QuerySpec');
  const queryTypePrefix = toPascalCase(params.queryName);
  const queryCaseTypeName = isZtdLane ? `${queryTypePrefix}QueryBoundaryZtdCase` : `${queryTypePrefix}QueryBoundaryTraditionalCase`;
  const queryTypesImportPath = isZtdLane ? './boundary-ztd-types.js' : './boundary-traditional-types.js';
  const beforeDbTypeLiteral = buildQueryFixtureTypeLiteral(
    params.planDetails.fixtureCandidateTables,
    buildQueryFixtureRowTypeLiteral(params.planDetails.queryFixtureRowFields)
  );
  const beforeDbValueLiteral = buildQueryFixtureValueLiteral(params.planDetails.fixtureCandidateTables);
  const queryInputTypeLiteral = buildRecordShapeTypeLiteral(params.planDetails.queryInputFields);
  const queryOutputTypeLiteral = buildRecordShapeTypeLiteral(params.planDetails.queryOutputFields);
  const beforeDbTodoLines = renderTodoCommentLines(
    'TODO: Fill fixture rows for the tables the CLI could identify. Remove rows that are not needed for this case.',
    params.planDetails.fixtureCandidateTables
  );
  const inputTodoLines = renderTodoCommentLines(
    'TODO: Replace the placeholder input with concrete query parameters before enabling the generated test.',
    params.planDetails.queryInputFields
  );
  const outputTodoLines = renderTodoCommentLines(
    'TODO: Replace the placeholder output with the exact result expected from the query boundary.',
    params.planDetails.queryOutputFields
  );
  const vitestEntrypointFile = isZtdLane
    ? [
      `import { expect, test } from 'vitest';`,
      '',
      `import { runQuerySpecZtdCases } from '${harnessImportPath}';`,
      `import { ${executorName} } from '${querySpecImportPath}';`,
      `import cases from '${casesImportPath}';`,
      `import type { ${queryCaseTypeName} } from '${queryTypesImportPath}';`,
      '',
      `test.skip('${params.featureName}/${params.queryName} boundary ZTD case scaffold placeholder', async () => {`,
      '  // TODO: Fill tests/cases/basic.case.ts, then change this to test(...).',
      '  expect(cases.length).toBeGreaterThan(0);',
      `  const evidence = await runQuerySpecZtdCases(cases, ${executorName});`,
      "  expect(evidence.every((entry) => entry.mode === 'ztd')).toBe(true);",
      '  expect(evidence.every((entry) => entry.physicalSetupUsed === false)).toBe(true);',
      '});',
      ''
    ].join('\n')
    : [
      `import { expect, test } from 'vitest';`,
      '',
      `import { ${executorName} } from '${querySpecImportPath}';`,
      `import cases from '${casesImportPath}';`,
      `import type { ${queryCaseTypeName} } from '${queryTypesImportPath}';`,
      '',
      `test.skip('${params.featureName}/${params.queryName} boundary traditional lane scaffold placeholder', async () => {`,
      '  expect(cases.length).toBeGreaterThan(0);',
      '  // TODO(issue-767 follow-up): wire this lane to the library traditional mode API.',
      `  void ${executorName};`,
      '});',
      ''
    ].join('\n');

  const basicCaseFile = [
    `import type { ${queryTypePrefix}BeforeDb, ${queryTypePrefix}Input, ${queryTypePrefix}Output, ${queryCaseTypeName} } from '${isZtdLane ? '../boundary-ztd-types.js' : '../boundary-traditional-types.js'}';`,
    '',
    `const cases: readonly ${queryCaseTypeName}[] = [`,
    '  {',
    "    name: 'basic-success',",
    ...beforeDbTodoLines,
    `    beforeDb: ${beforeDbValueLiteral} as ${queryTypePrefix}BeforeDb,`,
    ...inputTodoLines,
    `    input: {} as ${queryTypePrefix}Input,`,
    ...outputTodoLines,
    `    output: {} as ${queryTypePrefix}Output,`,
    '  }',
    '];',
    '',
    'export default cases;',
    ''
  ].join('\n');

  const queryTypesFile = isZtdLane
    ? [
      `import type { QuerySpecZtdCase } from '${useStableTestSupportImports ? TESTS_SUPPORT_CASE_TYPES_IMPORT_PATH : '../../../../../../tests/support/ztd/case-types.js'}';`,
      '',
      `export type ${queryTypePrefix}BeforeDb = ${beforeDbTypeLiteral};`,
      `export type ${queryTypePrefix}Input = ${queryInputTypeLiteral};`,
      `export type ${queryTypePrefix}Output = ${queryOutputTypeLiteral};`,
      '',
      `export type ${queryCaseTypeName} = QuerySpecZtdCase<`,
      `  ${queryTypePrefix}BeforeDb,`,
      `  ${queryTypePrefix}Input,`,
      `  ${queryTypePrefix}Output`,
      '>;',
      ''
    ].join('\n')
    : [
      `export type ${queryTypePrefix}BeforeDb = ${beforeDbTypeLiteral};`,
      `export type ${queryTypePrefix}Input = ${queryInputTypeLiteral};`,
      `export type ${queryTypePrefix}Output = ${queryOutputTypeLiteral};`,
      '',
      `export type ${queryCaseTypeName} = {`,
      '  readonly name: string;',
      `  readonly beforeDb: ${queryTypePrefix}BeforeDb;`,
      `  readonly input: ${queryTypePrefix}Input;`,
      `  readonly output: ${queryTypePrefix}Output;`,
      '  readonly afterDb?: Record<string, unknown>;',
      '};',
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
  testKind: FeatureTestKind;
}): TestPlanDetails {
  const entrySpecFile = path.join(params.featureDir, 'boundary.ts');
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
    testKind: params.testKind,
    fixtureCandidateTables,
    writesTables,
    validationScenarioHints: buildValidationScenarioHints(requestFields, params.queryLayout.queryName),
    dbScenarioHints: buildDbScenarioHints(params.testKind, writesTables, params.queryLayout.queryName, fixtureCandidateTables),
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
    fixedVerifierPath: params.testKind === 'ztd'
      ? 'tests/support/ztd/harness.ts'
      : 'TODO: library traditional mode API adapter'
  };
}

function buildValidationScenarioHints(requestFields: string[], queryName: string): string[] {
  const hints = [
    'Keep feature-boundary validation separate from query-boundary DB-backed execution.',
    'Validation failures belong in the feature-root mock test lane.'
  ];

  if (requestFields.length > 0) {
    hints.push(`Required request fields in feature boundary: ${requestFields.map((field) => `\`${field}\``).join(', ')}.`);
  } else {
    hints.push(`No required request fields were extracted for ${queryName}; keep the feature-boundary test focused on normalization and boundary rules.`);
  }

  return hints;
}

function buildDbScenarioHints(
  testKind: FeatureTestKind,
  writesTables: string[],
  queryName: string,
  fixtureCandidateTables: string[]
): string[] {
  const hints = testKind === 'ztd'
    ? [
      'Use the fixed app-level harness and query-local cases to keep the ZTD path thin.',
      'Keep db/input/output visible in the case file so the AI can fill the query contract without re-deriving the scaffold.'
    ]
    : [
      'Use this scaffold as a lane-specific starting point and wire execution through the library traditional mode API adapter.',
      'Keep db/input/output/afterDb visible in the case file so physical-state verification intent stays explicit.'
    ];

  if (writesTables.length > 0) {
    hints.push(`Write tables for ${queryName}: ${writesTables.map((table) => `\`${table}\``).join(', ')}.`);
    hints.push(
      testKind === 'ztd'
        ? 'Switch to a traditional DB-state lane when you need post-execution table assertions.'
        : 'Add post-execution table assertions in this lane when physical-state verification is required.'
    );
  } else if (fixtureCandidateTables.length > 0) {
    hints.push(`Read tables for ${queryName}: ${fixtureCandidateTables.map((table) => `\`${table}\``).join(', ')}.`);
    hints.push('DB-backed cases should seed the minimum fixture rows needed to make the query result shape obvious.');
  } else {
    hints.push(`No table references were discovered for ${queryName}; inspect SQL and query boundary manually before filling the case.`);
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

function renderTodoCommentLines(message: string, hints: string[]): string[] {
  const lines = [`    // ${message}`];
  const normalized = dedupeStrings(hints);
  if (normalized.length === 0) {
    lines.push('    // CLI hints: none discovered; inspect boundary.ts, SQL, DDL, and TEST_PLAN.md.');
    return lines;
  }

  lines.push(`    // CLI hints: ${normalized.join(', ')}.`);
  return lines;
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
  const match = sqlSource.match(/\breturning\s+([^;]+)\s*;?\s*$/i);
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

function resolveQueryLayout(
  featureDir: string,
  featureName: string,
  selectedQueryName: string | undefined,
  testKind: FeatureTestKind
): QueryLayout {
  const queriesRoot = path.join(featureDir, 'queries');
  if (!existsSync(queriesRoot)) {
    throw new Error(`No queries directory was discovered under ${featureDir}. Run feature scaffold first.`);
  }

  const queryDirectories = readdirSync(queriesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((entry) => existsSync(path.join(queriesRoot, entry, 'boundary.ts')))
    .sort((a, b) => a.localeCompare(b));

  if (selectedQueryName) {
    if (!queryDirectories.includes(selectedQueryName)) {
      throw new Error(`Query directory not found for tests scaffold: ${selectedQueryName}.`);
    }
    return buildQueryLayout(featureDir, featureName, selectedQueryName, testKind);
  }

  if (queryDirectories.length === 0) {
    throw new Error(`No boundary.ts file was discovered under ${queriesRoot}. Run feature scaffold first.`);
  }

  if (queryDirectories.length > 1) {
    throw new Error(`Multiple query directories were discovered under ${featureDir}. Re-run with --query <name>.`);
  }

  return buildQueryLayout(featureDir, featureName, queryDirectories[0], testKind);
}

function buildQueryLayout(featureDir: string, featureName: string, queryName: string, testKind: FeatureTestKind): QueryLayout {
  const queryDir = path.join(featureDir, 'queries', queryName);
  const testsDir = path.join(queryDir, 'tests');
  const generatedDir = path.join(testsDir, 'generated');
  const casesDir = path.join(testsDir, 'cases');
  const isZtdLane = testKind === 'ztd';
  return {
    featureName,
    queryName,
    queryDir,
    testsDir,
    generatedDir,
    casesDir,
    entrypointFile: path.join(testsDir, `${queryName}.boundary.${testKind}.test.ts`),
    queryTypesFile: path.join(testsDir, isZtdLane ? 'boundary-ztd-types.ts' : 'boundary-traditional-types.ts'),
    planFile: path.join(generatedDir, isZtdLane ? 'TEST_PLAN.md' : 'TEST_PLAN.traditional.md'),
    analysisFile: path.join(generatedDir, isZtdLane ? 'analysis.json' : 'analysis.traditional.json'),
    basicCaseFile: path.join(casesDir, isZtdLane ? 'basic.case.ts' : 'basic.traditional.case.ts'),
    querySpecFile: path.join(queryDir, 'boundary.ts'),
    querySqlFile: path.join(queryDir, `${queryName}.sql`)
  };
}

function normalizeFeatureTestKind(value: string | undefined): FeatureTestKind {
  const normalized = (value ?? 'ztd').trim().toLowerCase();
  if (FEATURE_TEST_KINDS.includes(normalized as FeatureTestKind)) {
    return normalized as FeatureTestKind;
  }

  throw new Error(`Feature test kind supports only ${FEATURE_TEST_KINDS.join(', ')}.`);
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
    `Refusing to overwrite query-boundary generated feature test scaffold files without --force: ${existingPaths.map(normalizeCliPath).join(', ')}`
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
