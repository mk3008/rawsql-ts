import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Command } from 'commander';
import {
  buildSpecificationModel,
  buildDiffJson,
  stableStringify as coreStableStringify,
  type DiffCase as CorePrDiffCase,
  type DiffCatalog as CorePrDiffCatalog,
  type DiffJson as CoreTestSpecificationPrDiff,
  type PreviewJson as TestEvidencePreviewJson
} from '@rawsql-ts/test-evidence-core';
import {
  renderDiffMarkdown,
  renderSpecificationMarkdown,
  renderTestDocumentationMarkdown,
  type DefinitionLinkOptions,
  type RemovedDetailLevel
} from '@rawsql-ts/test-evidence-renderer-md';
import {
  discoverProjectSqlCatalogSpecFiles,
  isPlainObject,
  loadSqlCatalogSpecsFromFile,
  walkSqlCatalogSpecFiles,
  type LoadedSqlCatalogSpec
} from '../utils/sqlCatalogDiscovery';
import { parseJsonPayload } from '../utils/agentCli';

/**
 * Supported evidence generation modes for `ztd evidence`.
 */
export type TestEvidenceMode = 'specification';

/**
 * Output formats accepted by `ztd evidence`.
 */
export type TestEvidenceFormat = 'json' | 'markdown' | 'both';
type TestEvidenceErrorCode = 'NO_SPECS_FOUND';

/**
 * Evidence row summarizing one SQL catalog spec file.
 */
export interface SqlCatalogSpecEvidence {
  kind: 'sql-catalog';
  id: string;
  specFile: string;
  sqlFile: string | null;
  sqlFileResolved: boolean;
  paramsShape: 'named' | 'positional' | 'unknown';
  hasOutputMapping: boolean;
}

/**
 * Flattened executable test-case evidence row.
 */
export interface TestCaseEvidence {
  kind: 'test-case';
  id: string;
  catalogId: string;
  caseId: string;
  filePath: string;
  title: string;
  description?: string;
}

/**
 * Top-level deterministic evidence document for specification mode.
 */
export interface TestSpecificationEvidence {
  schemaVersion: 1;
  mode: TestEvidenceMode;
  summary: {
    sqlCatalogCount: number;
    sqlCaseCatalogCount: number;
    testCaseCount: number;
    specFilesScanned: number;
    testFilesScanned: number;
  };
  sqlCatalogs: SqlCatalogSpecEvidence[];
  sqlCaseCatalogs: SqlCaseCatalogEvidence[];
  testCaseCatalogs: TestCaseCatalogEvidence[];
  testCases: TestCaseEvidence[];
  display?: {
    summaryOnly: boolean;
    limit?: number;
    truncated: boolean;
  };
}

/**
 * Normalized case payload used for deterministic PR diff calculation.
 */
export type PrDiffCase = CorePrDiffCase;

/**
 * Normalized catalog payload used for deterministic PR diff calculation.
 */
export type PrDiffCatalog = CorePrDiffCatalog;

/**
 * Deterministic diff document for PR-focused test evidence output.
 */
export type TestSpecificationPrDiff = CoreTestSpecificationPrDiff;

/**
 * Deterministic evidence representation of an executable function test catalog.
 */
export interface TestCaseCatalogEvidence {
  id: string;
  title: string;
  description?: string;
  definitionPath?: string;
  refs?: Array<{
    label: string;
    url: string;
  }>;
  cases: Array<{
    id: string;
    title: string;
    description?: string;
    input: unknown;
    expected: 'success' | 'throws' | 'errorResult';
    output?: unknown;
    error?: {
      name: string;
      message: string;
      match: 'equals' | 'contains';
    };
    tags?: string[];
    focus?: string;
    refs?: Array<{
      label: string;
      url: string;
    }>;
  }>;
}

/**
 * Deterministic evidence representation of an executable SQL case catalog.
 */
export interface SqlCaseCatalogEvidence {
  id: string;
  title: string;
  description?: string;
  definitionPath?: string;
  params: { shape: 'named'; example: Record<string, unknown> };
  output: { mapping: { columnMap: Record<string, string> } };
  sql: string;
  fixtures: Array<{
    tableName: string;
    schema?: { columns: Record<string, string> };
    rowsCount: number;
  }>;
  cases: Array<{
    id: string;
    title: string;
    params: Record<string, unknown>;
    expected: unknown[];
  }>;
}

interface TestEvidenceCommandOptions {
  mode: string;
  format: string;
  outDir: string;
  scopeDir?: string;
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
  json?: string;
  summaryOnly?: boolean;
  limit?: string;
}

interface TestEvidencePrCommandOptions {
  base?: string;
  head?: string;
  baseMode?: string;
  allowEmptyBase?: boolean;
  removedDetail?: string;
  outDir?: string;
  scopeDir?: string;
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
  json?: string;
  summaryOnly?: boolean;
  limit?: string;
}

interface TestDocCommandOptions {
  out?: string;
  scopeDir?: string;
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
  json?: string;
}

interface TestCaseCatalogDocumentLike {
  catalogs?: unknown;
}

interface TestCaseCatalogLike {
  id?: unknown;
  title?: unknown;
  cases?: unknown;
}

interface TestCaseLike {
  id?: unknown;
  title?: unknown;
  description?: unknown;
}

interface EvidenceModuleLike {
  testCaseCatalogs?: unknown;
  sqlCatalogCases?: unknown;
}

/**
 * Runtime/configuration error for test evidence command (maps to exit code 2).
 */
export class TestEvidenceRuntimeError extends Error {
  readonly exitCode = 2;
  readonly code?: TestEvidenceErrorCode;

  constructor(message: string, options?: { code?: TestEvidenceErrorCode }) {
    super(message);
    this.name = 'TestEvidenceRuntimeError';
    this.code = options?.code;
  }
}

/**
 * Resolve command exit code for test evidence generation.
 * @param args.result Completed generation result when execution succeeded.
 * @param args.error Error thrown while generating evidence.
 * @returns 0 when generation succeeded, 2 for runtime/configuration errors, 1 for other failures.
 */
export function resolveTestEvidenceExitCode(args: {
  result?: TestSpecificationEvidence;
  error?: unknown;
}): 0 | 1 | 2 {
  if (args.error) {
    return args.error instanceof TestEvidenceRuntimeError ? 2 : 1;
  }
  if (!args.result) {
    return 2;
  }
  return 0;
}

/**
 * Register `ztd evidence` command on the CLI root program.
 */
export function registerTestEvidenceCommand(program: Command): void {
  const evidenceCommand = program
    .command('evidence')
    .alias('test-evidence')
    .description('Generate deterministic test specification evidence artifacts')
    .option('--mode <mode>', 'Evidence mode (specification)', 'specification')
    .option('--format <format>', 'Output format (json|markdown|both)', 'both')
    .option('--out-dir <path>', 'Output directory', '.ztd/test-evidence')
    .option('--scope-dir <path>', 'Limit QuerySpec discovery to one feature, boundary, or subtree')
    .option('--specs-dir <path>', 'Legacy override for a fixed SQL catalog specs directory')
    .option('--tests-dir <path>', 'Override tests directory (default: tests)')
    .option('--spec-module <path>', 'Explicit evidence module path (default: tests/specs/index)')
    .option('--json <payload>', 'Pass evidence options as a JSON object')
    .option('--summary-only', 'Write only summary counts without catalog or case detail payloads')
    .option('--limit <count>', 'Limit returned catalogs and cases in generated artifacts')
    .action((options: TestEvidenceCommandOptions) => {
      try {
        const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
        const mode = normalizeMode(String(merged.mode));
        const format = normalizeFormat(String(merged.format));
        const report = applyEvidenceOutputControls(
          runTestEvidenceSpecification({
          mode,
          rootDir: process.env.ZTD_PROJECT_ROOT,
          scopeDir: merged.scopeDir as string | undefined,
          specsDir: merged.specsDir as string | undefined,
          testsDir: merged.testsDir as string | undefined,
          specModule: merged.specModule as string | undefined
          }),
          {
            summaryOnly: Boolean(merged.summaryOnly),
            limit: normalizeEvidenceLimit(merged.limit as string | undefined)
          }
        );
        const sourceRootDir = path.resolve(process.env.ZTD_PROJECT_ROOT ?? process.cwd());
        writeArtifacts({
          report,
          format,
          outDir: path.resolve(process.cwd(), String(merged.outDir)),
          sourceRootDir
        });
        process.exitCode = resolveTestEvidenceExitCode({ result: report });
      } catch (error) {
        process.exitCode = resolveTestEvidenceExitCode({ error });
        console.error(error instanceof Error ? error.message : String(error));
      }
    });
  evidenceCommand
    .command('test-doc')
    .description('Generate human-readable Markdown test documentation from ZTD test assets')
    .option('--out <path>', 'Output markdown path', '.ztd/test-evidence/test-documentation.md')
    .option('--scope-dir <path>', 'Limit QuerySpec discovery to one feature, boundary, or subtree')
    .option('--specs-dir <path>', 'Legacy override for a fixed SQL catalog specs directory')
    .option('--tests-dir <path>', 'Override tests directory (default: tests)')
    .option('--spec-module <path>', 'Explicit evidence module path (default: tests/specs/index)')
    .option('--json <payload>', 'Pass test-doc options as a JSON object')
    .action((options: TestDocCommandOptions) => {
      try {
        const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
        const report = runTestEvidenceSpecification({
          mode: 'specification',
          rootDir: process.env.ZTD_PROJECT_ROOT,
          scopeDir: merged.scopeDir as string | undefined,
          specsDir: merged.specsDir as string | undefined,
          testsDir: merged.testsDir as string | undefined,
          specModule: merged.specModule as string | undefined
        });
        const sourceRootDir = path.resolve(process.env.ZTD_PROJECT_ROOT ?? process.cwd());
        writeTestDocumentationArtifact({
          report,
          outPath: path.resolve(process.cwd(), String(merged.out ?? '.ztd/test-evidence/test-documentation.md')),
          sourceRootDir
        });
        process.exitCode = resolveTestEvidenceExitCode({ result: report });
      } catch (error) {
        process.exitCode = resolveTestEvidenceExitCode({ error });
        console.error(error instanceof Error ? error.message : String(error));
      }
    });

  evidenceCommand
    .command('pr')
    .description('Generate PR diff evidence from base/head specification JSON projections')
    .option('--base <ref>', 'Base git ref', 'main')
    .option('--head <ref>', 'Head git ref', 'HEAD')
    .option('--base-mode <mode>', 'Base resolution mode (merge-base|ref)', 'merge-base')
    .option('--allow-empty-base', 'Allow empty base evidence when head has catalogs')
    .option('--removed-detail <level>', 'Removed case detail level (none|input|full)', 'input')
    .option('--out-dir <path>', 'Output directory', 'artifacts/test-evidence')
    .option('--scope-dir <path>', 'Limit QuerySpec discovery to one feature, boundary, or subtree')
    .option('--specs-dir <path>', 'Legacy override for a fixed SQL catalog specs directory')
    .option('--tests-dir <path>', 'Override tests directory (default: tests)')
    .option('--spec-module <path>', 'Explicit evidence module path (default: tests/specs/index)')
    .option('--json <payload>', 'Pass PR evidence options as a JSON object')
    .option('--summary-only', 'Write PR evidence with summary-only base/head projections')
    .option('--limit <count>', 'Limit returned catalogs and cases in base/head projections')
    .action((options: TestEvidencePrCommandOptions) => {
      try {
        const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
        const output = runTestEvidencePr({
          baseRef: String(merged.base ?? 'main'),
          headRef: String(merged.head ?? 'HEAD'),
          baseMode: normalizeBaseMode(String(merged.baseMode ?? 'merge-base')),
          allowEmptyBase: Boolean(merged.allowEmptyBase),
          removedDetail: normalizeRemovedDetail(String(merged.removedDetail ?? 'input')),
          outDir: String(merged.outDir ?? 'artifacts/test-evidence'),
          rootDir: process.env.ZTD_PROJECT_ROOT,
          scopeDir: merged.scopeDir as string | undefined,
          specsDir: merged.specsDir as string | undefined,
          testsDir: merged.testsDir as string | undefined,
          specModule: merged.specModule as string | undefined,
          summaryOnly: Boolean(merged.summaryOnly),
          limit: normalizeEvidenceLimit(merged.limit as string | undefined)
        });
        process.exitCode = resolveTestEvidenceExitCode({ result: output.headReport });
      } catch (error) {
        process.exitCode = resolveTestEvidenceExitCode({ error });
        console.error(error instanceof Error ? error.message : String(error));
      }
    });
}

function normalizeMode(mode: string): TestEvidenceMode {
  const normalized = mode.trim().toLowerCase();
  if (normalized !== 'specification') {
    throw new TestEvidenceRuntimeError(`Unsupported mode: ${mode}`);
  }
  return 'specification';
}

function normalizeFormat(format: string): TestEvidenceFormat {
  const normalized = format.trim().toLowerCase();
  if (normalized === 'json' || normalized === 'markdown' || normalized === 'both') {
    return normalized;
  }
  throw new TestEvidenceRuntimeError(`Unsupported format: ${format}`);
}

function normalizeBaseMode(mode: string): 'merge-base' | 'ref' {
  const normalized = mode.trim().toLowerCase();
  if (normalized === 'merge-base' || normalized === 'ref') {
    return normalized;
  }
  throw new TestEvidenceRuntimeError(`Unsupported base-mode: ${mode}`);
}

function normalizeRemovedDetail(level: string): RemovedDetailLevel {
  const normalized = level.trim().toLowerCase();
  if (normalized === 'none' || normalized === 'input' || normalized === 'full') {
    return normalized;
  }
  throw new TestEvidenceRuntimeError(`Unsupported removed-detail: ${level}`);
}

/**
 * Build deterministic specification evidence from SQL catalog specs and test-case catalog exports.
 */
export function runTestEvidenceSpecification(options: {
  mode: TestEvidenceMode;
  rootDir?: string;
  scopeDir?: string;
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
}): TestSpecificationEvidence {
  const root = path.resolve(options.rootDir ?? process.cwd());
  const testsDir = options.testsDir ? path.resolve(root, options.testsDir) : path.resolve(root, 'tests');

  const sqlSpecFiles = resolveTestEvidenceSpecFiles(root, options);
  const evidenceModule = loadEvidenceModule(root, testsDir, options.specModule);
  const testCaseCatalogFiles = existsSync(testsDir) ? walkFiles(testsDir, isTestCaseCatalogFile) : [];
  const legacyTestCases = evidenceModule ? [] : testCaseCatalogFiles.flatMap((filePath) => loadTestCaseCatalogEvidence(root, filePath));

  const testCaseCatalogs = evidenceModule
    ? readTestCaseCatalogsFromModule(evidenceModule)
        .map((catalog) => ({
          ...catalog,
          cases: [...catalog.cases].sort((a, b) => a.id.localeCompare(b.id))
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    : [];
  const testCasesFromModule = flattenTestCaseCatalogs(testCaseCatalogs);
  const sqlCaseCatalogsFromModule = evidenceModule ? readSqlCaseCatalogsFromModule(evidenceModule) : [];
  if (sqlSpecFiles.length === 0 && testCasesFromModule.length === 0 && legacyTestCases.length === 0 && sqlCaseCatalogsFromModule.length === 0) {
    throw new TestEvidenceRuntimeError(
      `No catalog specs or test-case evidence exports were found. Checked scope=${describeSpecDiscoveryScope(root, options)}, testsDir=${testsDir}`,
      { code: 'NO_SPECS_FOUND' }
    );
  }

  const sqlCatalogs = sqlSpecFiles
    .flatMap((filePath) =>
      loadSqlCatalogSpecsFromFile(filePath, (message) => new TestEvidenceRuntimeError(message))
    )
    .map((loaded) => toSqlEvidence(root, loaded))
    .sort((a, b) => a.id.localeCompare(b.id) || a.specFile.localeCompare(b.specFile));

  const testCases = [...testCasesFromModule, ...legacyTestCases]
    .sort((a, b) => a.id.localeCompare(b.id) || a.filePath.localeCompare(b.filePath));
  const sqlCaseCatalogs = sqlCaseCatalogsFromModule
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: 1,
    mode: options.mode,
    summary: {
      sqlCatalogCount: sqlCatalogs.length,
      sqlCaseCatalogCount: sqlCaseCatalogs.length,
      testCaseCount: testCases.length,
      specFilesScanned: sqlSpecFiles.length,
      testFilesScanned: evidenceModule ? 1 : testCaseCatalogFiles.length
    },
    sqlCatalogs,
    sqlCaseCatalogs,
    testCaseCatalogs,
    testCases
  };
}

function resolveTestEvidenceSpecFiles(
  root: string,
  options: { scopeDir?: string; specsDir?: string }
): string[] {
  if (options.scopeDir && options.specsDir) {
    throw new TestEvidenceRuntimeError('Use either --scope-dir or --specs-dir, not both.');
  }

  if (options.specsDir) {
    const specsDir = path.resolve(root, options.specsDir);
    return existsSync(specsDir) ? walkSqlCatalogSpecFiles(specsDir) : [];
  }

  if (options.scopeDir) {
    const scopeDir = path.resolve(root, options.scopeDir);
    return existsSync(scopeDir) ? discoverProjectSqlCatalogSpecFiles(scopeDir) : [];
  }

  return discoverProjectSqlCatalogSpecFiles(root);
}

function describeSpecDiscoveryScope(root: string, options: { scopeDir?: string; specsDir?: string }): string {
  if (options.scopeDir) {
    return path.resolve(root, options.scopeDir);
  }
  if (options.specsDir) {
    return path.resolve(root, options.specsDir);
  }
  return root;
}

/**
 * Render deterministic JSON or Markdown output text.
 */
export function formatTestEvidenceOutput(
  report: TestSpecificationEvidence,
  format: Exclude<TestEvidenceFormat, 'both'>,
  context?: { markdownPath?: string; sourceRootDir?: string }
): string {
  if (format === 'json') {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  if (report.display?.summaryOnly) {
    const lines = [
      '# Test Specification Summary',
      '',
      `- schemaVersion: ${report.schemaVersion}`,
      `- mode: ${report.mode}`,
      `- sqlCatalogCount: ${report.summary.sqlCatalogCount}`,
      `- sqlCaseCatalogCount: ${report.summary.sqlCaseCatalogCount}`,
      `- testCaseCount: ${report.summary.testCaseCount}`,
      `- specFilesScanned: ${report.summary.specFilesScanned}`,
      `- testFilesScanned: ${report.summary.testFilesScanned}`,
      `- truncated: ${report.display.truncated}`,
      report.display.limit !== undefined ? `- limit: ${report.display.limit}` : ''
    ].filter(Boolean);
    return `${lines.join('\n')}\n`;
  }

  const model = buildSpecificationModel(report as TestEvidencePreviewJson);
  return `${renderSpecificationMarkdown(model, {
    definitionLinks: resolveDefinitionLinkOptions(context)
  })}\n`;
}

/**
 * Stable stringify that sorts object keys recursively for deterministic fingerprinting.
 */
export function stableStringify(value: unknown): string {
  return coreStableStringify(value);
}

/**
 * Build deterministic PR diff JSON from base/head specification reports.
 */
export function buildTestEvidencePrDiff(args: {
  base: { ref: string; sha: string; report: TestSpecificationEvidence };
  head: { ref: string; sha: string; report: TestSpecificationEvidence };
  baseMode: 'merge-base' | 'ref';
}): TestSpecificationPrDiff {
  return buildDiffJson({
    base: {
      ref: args.base.ref,
      sha: args.base.sha,
      previewJson: args.base.report as TestEvidencePreviewJson
    },
    head: {
      ref: args.head.ref,
      sha: args.head.sha,
      previewJson: args.head.report as TestEvidencePreviewJson
    },
    baseMode: args.baseMode
  }) as TestSpecificationPrDiff;
}

/**
 * Render PR-focused markdown from diff JSON.
 */
export function formatTestEvidencePrMarkdown(
  diff: TestSpecificationPrDiff,
  options?: { removedDetail?: RemovedDetailLevel; markdownPath?: string; sourceRootDir?: string }
): string {
  return renderDiffMarkdown(diff, {
    definitionLinks: resolveDefinitionLinkOptions({
      markdownPath: options?.markdownPath,
      sourceRootDir: options?.sourceRootDir
    })
  });
}

function resolveDefinitionLinkOptions(context?: { markdownPath?: string; sourceRootDir?: string }): DefinitionLinkOptions {
  const serverUrl = process.env.GITHUB_SERVER_URL?.trim();
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  const ref = process.env.GITHUB_SHA?.trim();
  if (serverUrl && repository && ref) {
    return {
      mode: 'github',
      github: {
        serverUrl,
        repository,
        ref
      }
    };
  }
  if (context?.markdownPath && context?.sourceRootDir) {
    return {
      mode: 'path',
      path: {
        markdownDir: path.dirname(context.markdownPath),
        sourceRootDir: context.sourceRootDir
      }
    };
  }
  return { mode: 'path' };
}

/**
 * Generate base/head reports, compute PR diff JSON, and write PR artifacts.
 */
export function runTestEvidencePr(options: {
  baseRef: string;
  headRef: string;
  baseMode: 'merge-base' | 'ref';
  allowEmptyBase?: boolean;
  removedDetail?: RemovedDetailLevel;
  outDir: string;
  rootDir?: string;
  scopeDir?: string;
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
  summaryOnly?: boolean;
  limit?: number;
}): {
  baseReport: TestSpecificationEvidence;
  headReport: TestSpecificationEvidence;
  diff: TestSpecificationPrDiff;
} {
  const root = path.resolve(options.rootDir ?? process.cwd());
  const tempRoot = path.resolve(root, '.tmp', 'test-evidence-worktree');
  mkdirSync(tempRoot, { recursive: true });
  const createdWorktrees: string[] = [];
  const resolvedHeadSha = resolveGitSha(root, options.headRef);
  const resolvedBaseSha =
    options.baseMode === 'merge-base'
      ? resolveGitMergeBase(root, options.baseRef, options.headRef)
      : resolveGitSha(root, options.baseRef);
  const currentHeadSha = resolveGitSha(root, 'HEAD');

  try {
    const headMaterialized = materializeEvidenceForRef({
      repoRoot: root,
      ref: options.headRef,
      resolvedSha: resolvedHeadSha,
      allowCurrentWorkspace: resolvedHeadSha === currentHeadSha,
      tempRoot,
      createdWorktrees,
      specsDir: options.specsDir,
      testsDir: options.testsDir,
      specModule: options.specModule,
      scopeDir: options.scopeDir,
      summaryOnly: options.summaryOnly,
      limit: options.limit
    });
    const baseMaterialized = materializeEvidenceForRef({
      repoRoot: root,
      ref: options.baseRef,
      resolvedSha: resolvedBaseSha,
      allowCurrentWorkspace: resolvedBaseSha === currentHeadSha,
      tempRoot,
      createdWorktrees,
      specsDir: options.specsDir,
      testsDir: options.testsDir,
      specModule: options.specModule,
      scopeDir: options.scopeDir,
      summaryOnly: options.summaryOnly,
      limit: options.limit
    });
    console.log(`base preview: ${baseMaterialized.previewJsonPath}`);
    console.log(`head preview: ${headMaterialized.previewJsonPath}`);

    const diff = buildTestEvidencePrDiff({
      base: { ref: options.baseRef, sha: baseMaterialized.sha, report: baseMaterialized.report },
      head: { ref: options.headRef, sha: headMaterialized.sha, report: headMaterialized.report },
      baseMode: options.baseMode
    });
    if (!options.allowEmptyBase && diff.totals.base.catalogs === 0 && diff.totals.head.catalogs > 0) {
      throw new TestEvidenceRuntimeError(
        'Base test evidence is empty.\nThis likely indicates preview generation failed at base ref.\nIf this is intentional, re-run with --allow-empty-base.'
      );
    }

    const outDir = path.resolve(root, options.outDir);
    mkdirSync(outDir, { recursive: true });
    const diffJsonPath = path.join(outDir, 'test-specification.pr.json');
    const diffMdPath = path.join(outDir, 'test-specification.pr.md');
    writeFileSync(diffJsonPath, `${JSON.stringify(diff, null, 2)}\n`, 'utf8');
    writeFileSync(
      diffMdPath,
      formatTestEvidencePrMarkdown(diff, {
        removedDetail: options.removedDetail,
        markdownPath: diffMdPath,
        sourceRootDir: root
      }),
      'utf8'
    );
    console.log(`wrote: ${diffJsonPath}`);
    console.log(`wrote: ${diffMdPath}`);

    return {
      baseReport: baseMaterialized.report,
      headReport: headMaterialized.report,
      diff
    };
  } finally {
    cleanupWorktrees(root, createdWorktrees);
  }
}

function writeArtifacts(args: {
  report: TestSpecificationEvidence;
  format: TestEvidenceFormat;
  outDir: string;
  sourceRootDir: string;
}): void {
  mkdirSync(args.outDir, { recursive: true });
  const writtenFiles: string[] = [];

  if (args.format === 'json' || args.format === 'both') {
    const jsonPath = path.join(args.outDir, 'test-specification.json');
    writeFileSync(jsonPath, formatTestEvidenceOutput(args.report, 'json'), 'utf8');
    writtenFiles.push(jsonPath);
  }

  if (args.format === 'markdown' || args.format === 'both') {
    const markdownPaths = args.report.display?.summaryOnly
      ? writeSpecificationSummaryMarkdown(args.report, args.outDir)
      : writeSpecificationMarkdownArtifacts(args.report, args.outDir, args.sourceRootDir);
    writtenFiles.push(...markdownPaths);
  }

  for (const filePath of writtenFiles.sort((a, b) => a.localeCompare(b))) {
    console.log(`wrote: ${filePath}`);
  }
}

function writeSpecificationSummaryMarkdown(report: TestSpecificationEvidence, outDir: string): string[] {
  const summaryPath = path.join(outDir, 'test-specification.summary.md');
  writeFileSync(summaryPath, formatTestEvidenceOutput(report, 'markdown'), 'utf8');
  return [summaryPath];
}

function writeSpecificationMarkdownArtifacts(
    report: TestSpecificationEvidence,
    outDir: string,
    sourceRootDir: string
  ): string[] {
  const indexFileName = 'test-specification.index.md';
  const model = buildSpecificationModel(report as TestEvidencePreviewJson);
  const catalogs = [...model.catalogs].sort((a, b) => a.catalogId.localeCompare(b.catalogId));
  const written: string[] = [];
  const catalogRows: Array<{
    fileName: string;
    catalogId: string;
    title: string;
    tests: number;
  }> = [];

  for (const catalog of catalogs) {
    const catalogSlug = toSpecificationSlug(catalog.catalogId);
    const catalogFileName = `test-specification.catalog.${catalogSlug}.md`;
    const catalogPath = path.join(outDir, catalogFileName);
      const catalogDefinitionLinks = resolveDefinitionLinkOptions({ markdownPath: catalogPath, sourceRootDir });
      const catalogLines: string[] = [];
      catalogLines.push(`# ${catalog.catalogId} Test Cases`);
      catalogLines.push('');
      catalogLines.push(`- schemaVersion: ${model.schemaVersion}`);
      catalogLines.push(`- index: [Unit Test Index](./${indexFileName})`);
      catalogLines.push(`- title: ${catalog.title}`);
      const definitionPath =
        catalog.definition ??
        findCatalogDefinitionPath(report, catalog.catalogId);
      catalogLines.push(`- definition: ${formatDefinitionLinkMarkdown(definitionPath, catalogDefinitionLinks)}`);
    if (catalog.description) {
      catalogLines.push(`- description: ${catalog.description}`);
    }
    if (Array.isArray(catalog.refs) && catalog.refs.length > 0) {
      catalogLines.push('- refs:');
      for (const ref of catalog.refs) {
        catalogLines.push(`  - [${ref.label}](${ref.url})`);
      }
    }
    catalogLines.push(`- tests: ${catalog.cases.length}`);
    if (catalog.kind === 'sql') {
      catalogLines.push(`- fixtures: ${(catalog.fixtures ?? []).join(', ') || '(none)'}`);
    }
    catalogLines.push('');

    const sortedCases = [...catalog.cases].sort((a, b) => a.id.localeCompare(b.id));
    for (const testCase of sortedCases) {
      catalogLines.push(`## ${testCase.id} - ${testCase.title}`);
      catalogLines.push(`- expected: ${testCase.expected}`);
      catalogLines.push(`- tags: ${formatCaseTags(testCase.tags)}`);
      catalogLines.push(`- focus: ${formatCaseFocus(testCase.focus)}`);
      if (Array.isArray(testCase.refs) && testCase.refs.length > 0) {
        catalogLines.push('- refs:');
        for (const ref of testCase.refs) {
          catalogLines.push(`  - [${ref.label}](${ref.url})`);
        }
      }
      catalogLines.push('### input');
      catalogLines.push('```json');
      catalogLines.push(stringifyStablePretty(testCase.input));
      catalogLines.push('```');
      if (testCase.expected === 'throws') {
        catalogLines.push('### error');
        catalogLines.push('```json');
        catalogLines.push(stringifyErrorPretty(testCase.error));
        catalogLines.push('```');
      } else {
        catalogLines.push('### output');
        catalogLines.push('```json');
        catalogLines.push(stringifyStablePretty(testCase.output));
        catalogLines.push('```');
      }
      catalogLines.push('');
    }

    catalogLines.push('');
    writeFileSync(catalogPath, `${catalogLines.join('\n')}\n`, 'utf8');
    written.push(catalogPath);
    catalogRows.push({
      fileName: catalogFileName,
      catalogId: catalog.catalogId,
      title: catalog.title,
      tests: catalog.cases.length
    });
  }

  const indexPath = path.join(outDir, indexFileName);
  const indexLines: string[] = [];
  indexLines.push('# Unit Test Index');
  indexLines.push('');
  indexLines.push(`- catalogs: ${catalogRows.length}`);
  indexLines.push('');
  indexLines.push('## Catalog Files');
  indexLines.push('');
  for (const row of catalogRows.sort((a, b) => a.fileName.localeCompare(b.fileName))) {
    indexLines.push(`- [${row.catalogId}](./${row.fileName})`);
    indexLines.push(`  - title: ${row.title}`);
    indexLines.push(`  - tests: ${row.tests}`);
  }
  indexLines.push('');
  writeFileSync(indexPath, `${indexLines.join('\n')}\n`, 'utf8');
  written.push(indexPath);

  return written;
}

export function applyEvidenceOutputControls(
  report: TestSpecificationEvidence,
  options: { summaryOnly?: boolean; limit?: number }
): TestSpecificationEvidence {
  const summaryOnly = Boolean(options.summaryOnly);
  const limit = options.limit;

  if (summaryOnly) {
    return {
      ...report,
      sqlCatalogs: [],
      sqlCaseCatalogs: [],
      testCaseCatalogs: [],
      testCases: [],
      display: {
        summaryOnly: true,
        limit,
        truncated:
          report.sqlCatalogs.length > 0 ||
          report.sqlCaseCatalogs.length > 0 ||
          report.testCaseCatalogs.length > 0 ||
          report.testCases.length > 0
      }
    };
  }

  if (limit === undefined) {
    return report;
  }

  const limited = {
    ...report,
    sqlCatalogs: report.sqlCatalogs.slice(0, limit),
    sqlCaseCatalogs: report.sqlCaseCatalogs.slice(0, limit).map((catalog) => ({
      ...catalog,
      cases: catalog.cases.slice(0, limit)
    })),
    testCaseCatalogs: report.testCaseCatalogs.slice(0, limit).map((catalog) => ({
      ...catalog,
      cases: catalog.cases.slice(0, limit)
    })),
    testCases: report.testCases.slice(0, limit),
    display: {
      summaryOnly: false,
      limit,
      truncated:
        report.sqlCatalogs.length > limit ||
        report.sqlCaseCatalogs.length > limit ||
        report.testCaseCatalogs.length > limit ||
        report.testCases.length > limit ||
        report.sqlCaseCatalogs.some((catalog) => catalog.cases.length > limit) ||
        report.testCaseCatalogs.some((catalog) => catalog.cases.length > limit)
    }
  };
  return limited;
}

function normalizeEvidenceLimit(value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TestEvidenceRuntimeError(`Unsupported limit: ${value}. Use a positive integer.`);
  }
  return parsed;
}

function findCatalogDefinitionPath(report: TestSpecificationEvidence, catalogId: string): string | undefined {
  const functionCatalog = report.testCaseCatalogs.find((catalog) => catalog.id === catalogId);
  if (functionCatalog?.definitionPath) {
    return functionCatalog.definitionPath;
  }
  const sqlCatalog = report.sqlCaseCatalogs.find((catalog) => catalog.id === catalogId);
  if (sqlCatalog?.definitionPath) {
    return sqlCatalog.definitionPath;
  }
  return undefined;
}

function toSpecificationSlug(definition: string): string {
  if (definition === '(unknown)') {
    return 'unknown';
  }
  const normalized = definition
    .replace(/\\/g, '/')
    .replace(/^\//, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/\/+/g, '__')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return normalized || 'unknown';
}

function formatDefinitionLinkMarkdown(
  definitionPath: string | undefined,
  options?: DefinitionLinkOptions
): string {
  if (!definitionPath) {
    return '(unknown)';
  }
  const normalizedPath = definitionPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalizedPath) {
    return '(unknown)';
  }
  if (options?.mode === 'github' && options.github) {
    const serverUrl = options.github.serverUrl.replace(/\/+$/, '');
    const repository = options.github.repository.trim();
    const ref = options.github.ref.trim();
    if (serverUrl && repository && ref) {
      const encodedPath = normalizedPath.split('/').map((part) => encodeURIComponent(part)).join('/');
      const url = `${serverUrl}/${repository}/blob/${encodeURIComponent(ref)}/${encodedPath}`;
      return `[${normalizedPath}](${url})`;
    }
  }
  if (options?.mode === 'path' && options.path) {
    const absoluteTarget = path.resolve(options.path.sourceRootDir, normalizedPath);
    const absoluteMarkdownDir = path.resolve(options.path.markdownDir);
    const relativePath = path.relative(absoluteMarkdownDir, absoluteTarget).replace(/\\/g, '/');
    return `[${normalizedPath}](${relativePath || normalizedPath})`;
  }
  return `[${normalizedPath}](${normalizedPath})`;
}

function materializeEvidenceForRef(args: {
  repoRoot: string;
  ref: string;
  resolvedSha: string;
  allowCurrentWorkspace: boolean;
  tempRoot: string;
  createdWorktrees: string[];
  scopeDir?: string;
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
  summaryOnly?: boolean;
  limit?: number;
}): { sha: string; report: TestSpecificationEvidence; previewJsonPath: string } {
  const toReport = (rootDir: string): TestSpecificationEvidence => {
    try {
      return applyEvidenceOutputControls(
        runTestEvidenceSpecification({
          mode: 'specification',
          rootDir,
          scopeDir: args.scopeDir,
          specsDir: args.specsDir,
          testsDir: args.testsDir,
          specModule: args.specModule
        }),
        {
          summaryOnly: args.summaryOnly,
          limit: args.limit
        }
      );
    } catch (error) {
      if (
        error instanceof TestEvidenceRuntimeError &&
        error.code === 'NO_SPECS_FOUND'
      ) {
        return createEmptySpecificationEvidence();
      }
      throw error;
    }
  };

  if (args.allowCurrentWorkspace) {
    const report = toReport(args.repoRoot);
    return {
      sha: args.resolvedSha,
      report,
      previewJsonPath: writePreviewSnapshot(args.repoRoot, report)
    };
  }

  const worktreeDir = mkdtempSync(path.join(args.tempRoot, 'wt-'));
  args.createdWorktrees.push(worktreeDir);
  runGitCommand(args.repoRoot, ['worktree', 'add', '--detach', worktreeDir, args.resolvedSha]);
  const report = toReport(worktreeDir);
  return {
    sha: args.resolvedSha,
    report,
    previewJsonPath: writePreviewSnapshot(worktreeDir, report)
  };
}

function createEmptySpecificationEvidence(): TestSpecificationEvidence {
  return {
    schemaVersion: 1,
    mode: 'specification',
    summary: {
      sqlCatalogCount: 0,
      sqlCaseCatalogCount: 0,
      testCaseCount: 0,
      specFilesScanned: 0,
      testFilesScanned: 0
    },
    sqlCatalogs: [],
    sqlCaseCatalogs: [],
    testCaseCatalogs: [],
    testCases: []
  };
}

function writePreviewSnapshot(rootDir: string, report: TestSpecificationEvidence): string {
  const previewDir = path.resolve(rootDir, 'artifacts', 'test-evidence');
  mkdirSync(previewDir, { recursive: true });
  const previewPath = path.join(previewDir, 'test-specification.preview.json');
  writeFileSync(previewPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return previewPath;
}

function cleanupWorktrees(repoRoot: string, worktreeDirs: string[]): void {
  for (const worktreeDir of [...worktreeDirs].reverse()) {
    try {
      runGitCommand(repoRoot, ['worktree', 'remove', '--force', worktreeDir]);
    } catch {
      rmSync(worktreeDir, { recursive: true, force: true });
    }
  }
}

function runGitCommand(repoRoot: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8'
    }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TestEvidenceRuntimeError(`Git command failed: git ${args.join(' ')} (${message})`);
  }
}

function resolveGitSha(repoRoot: string, ref: string): string {
  return runGitCommand(repoRoot, ['rev-parse', ref]);
}

function resolveGitMergeBase(repoRoot: string, baseRef: string, headRef: string): string {
  return runGitCommand(repoRoot, ['merge-base', baseRef, headRef]);
}

function toSqlEvidence(
  rootDir: string,
  loaded: LoadedSqlCatalogSpec
): SqlCatalogSpecEvidence {
  const id =
    typeof loaded.spec.id === 'string' && loaded.spec.id.trim().length > 0
      ? loaded.spec.id.trim()
      : `<missing-id:${path.basename(loaded.filePath)}>`;
  const sqlFile = typeof loaded.spec.sqlFile === 'string' && loaded.spec.sqlFile.trim().length > 0
    ? loaded.spec.sqlFile.trim()
    : null;
  const paramsShape = loaded.spec.params?.shape === 'named' || loaded.spec.params?.shape === 'positional'
    ? loaded.spec.params.shape
    : 'unknown';
  const resolvedSqlPath = sqlFile ? path.resolve(path.dirname(loaded.filePath), sqlFile) : null;
  const specFile = normalizePath(path.relative(rootDir, loaded.filePath));
  return {
    kind: 'sql-catalog',
    id,
    specFile,
    sqlFile,
    sqlFileResolved: Boolean(resolvedSqlPath && existsSync(resolvedSqlPath)),
    paramsShape,
    hasOutputMapping: loaded.spec.output?.mapping !== undefined
  };
}

function loadEvidenceModule(rootDir: string, testsDir: string, specModule?: string): EvidenceModuleLike | undefined {
  const moduleCandidates = resolveEvidenceModuleCandidates(rootDir, testsDir, specModule);
  const target = moduleCandidates.find((candidate) => existsSync(candidate));
  if (!target) {
    return undefined;
  }
  try {
    const requireFn = createRequire(__filename);
    const loaded = requireFn(target) as Record<string, unknown>;
    const normalized = loaded?.default && isPlainObject(loaded.default)
      ? loaded.default as Record<string, unknown>
      : loaded;
    return normalized as EvidenceModuleLike;
  } catch (error) {
    throw new TestEvidenceRuntimeError(
      `Failed to load evidence module ${target}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function resolveEvidenceModuleCandidates(rootDir: string, testsDir: string, specModule?: string): string[] {
  if (specModule) {
    const absolute = path.resolve(rootDir, specModule);
    return [
      absolute,
      `${absolute}.js`,
      `${absolute}.cjs`,
      `${absolute}.ts`
    ];
  }

  const base = path.resolve(testsDir, 'specs', 'index');
  return [
    `${base}.js`,
    `${base}.cjs`,
    `${base}.ts`
  ];
}

function readTestCaseCatalogsFromModule(moduleValue: EvidenceModuleLike): Array<{
  id: string;
  title: string;
  description?: string;
  definitionPath?: string;
  refs?: Array<{
    label: string;
    url: string;
  }>;
  cases: Array<{
    id: string;
    title: string;
    description?: string;
    input: unknown;
    expected: 'success' | 'throws' | 'errorResult';
    output?: unknown;
    error?: {
      name: string;
      message: string;
      match: 'equals' | 'contains';
    };
    tags?: string[];
    focus?: string;
    refs?: Array<{
      label: string;
      url: string;
    }>;
  }>;
}> {
  if (!Array.isArray(moduleValue.testCaseCatalogs)) {
    return [];
  }

  return moduleValue.testCaseCatalogs.map((catalog, index) => {
    if (!isPlainObject(catalog)) {
      throw new TestEvidenceRuntimeError(`testCaseCatalogs[${index}] must be an object in evidence module.`);
    }
    const id = typeof catalog.id === 'string' ? catalog.id.trim() : '';
    const title = typeof catalog.title === 'string' ? catalog.title.trim() : '';
    const cases = Array.isArray(catalog.cases) ? catalog.cases : [];
    if (!id || !title) {
      throw new TestEvidenceRuntimeError(`testCaseCatalogs[${index}] requires non-empty id/title.`);
    }
    const normalizedCases = cases.map((item, caseIndex) => {
      if (!isPlainObject(item)) {
        throw new TestEvidenceRuntimeError(`testCaseCatalogs[${index}].cases[${caseIndex}] must be an object.`);
      }
      const caseId = typeof item.id === 'string' ? item.id.trim() : '';
      const caseTitle = typeof item.title === 'string' ? item.title.trim() : '';
      if (!caseId || !caseTitle) {
        throw new TestEvidenceRuntimeError(`testCaseCatalogs[${index}].cases[${caseIndex}] requires non-empty id/title.`);
      }
      const description = typeof item.description === 'string' && item.description.trim().length > 0
        ? item.description.trim()
        : undefined;
      const hasDirectInput = Object.prototype.hasOwnProperty.call(item, 'input');
      const hasDirectOutput = Object.prototype.hasOwnProperty.call(item, 'output');
      const hasDirectExpected = Object.prototype.hasOwnProperty.call(item, 'expected');
      const hasDirectError = Object.prototype.hasOwnProperty.call(item, 'error');
      const hasDirectTags = Object.prototype.hasOwnProperty.call(item, 'tags');
      const hasDirectFocus = Object.prototype.hasOwnProperty.call(item, 'focus');
      const hasDirectRefs = Object.prototype.hasOwnProperty.call(item, 'refs');
      const evidenceValue = Object.prototype.hasOwnProperty.call(item, 'evidence') ? item.evidence : undefined;
      const hasEvidence = isPlainObject(evidenceValue);

      // Accept both normalized evidence shape and raw test catalog shape (`evidence.*`).
      const input = hasDirectInput
        ? item.input
        : hasEvidence && Object.prototype.hasOwnProperty.call(evidenceValue, 'input')
          ? evidenceValue.input
          : undefined;
      const output = hasDirectOutput
        ? item.output
        : hasEvidence && Object.prototype.hasOwnProperty.call(evidenceValue, 'output')
          ? evidenceValue.output
          : undefined;
      const expectedRaw = hasDirectExpected
        ? item.expected
        : hasEvidence && Object.prototype.hasOwnProperty.call(evidenceValue, 'expected')
          ? evidenceValue.expected
          : undefined;
      const expected: 'success' | 'throws' | 'errorResult' | undefined =
        expectedRaw === 'success' || expectedRaw === 'throws' || expectedRaw === 'errorResult'
          ? expectedRaw
          : output === undefined
            ? undefined
            : 'success';
      const errorRaw = hasDirectError
        ? item.error
        : hasEvidence && Object.prototype.hasOwnProperty.call(evidenceValue, 'error')
          ? evidenceValue.error
          : undefined;
      const tagsRaw = hasDirectTags
        ? item.tags
        : hasEvidence && Object.prototype.hasOwnProperty.call(evidenceValue, 'tags')
          ? evidenceValue.tags
          : undefined;
      const focusRaw = hasDirectFocus
        ? item.focus
        : hasEvidence && Object.prototype.hasOwnProperty.call(evidenceValue, 'focus')
          ? evidenceValue.focus
          : undefined;
      const refsRaw = hasDirectRefs
        ? item.refs
        : hasEvidence && Object.prototype.hasOwnProperty.call(evidenceValue, 'refs')
          ? evidenceValue.refs
          : undefined;
      if (input === undefined || expected === undefined) {
        throw new TestEvidenceRuntimeError(
          `testCaseCatalogs[${index}].cases[${caseIndex}] requires input/expected evidence fields.`
        );
      }
      if (expected !== 'throws' && output === undefined) {
        throw new TestEvidenceRuntimeError(
          `testCaseCatalogs[${index}].cases[${caseIndex}] requires output when expected is not "throws".`
        );
      }
      if (expected === 'throws') {
        if (!isPlainObject(errorRaw)) {
          throw new TestEvidenceRuntimeError(
            `testCaseCatalogs[${index}].cases[${caseIndex}] requires error when expected is "throws".`
          );
        }
        if (
          typeof errorRaw.name !== 'string' ||
          typeof errorRaw.message !== 'string' ||
          (errorRaw.match !== 'equals' && errorRaw.match !== 'contains')
        ) {
          throw new TestEvidenceRuntimeError(
            `testCaseCatalogs[${index}].cases[${caseIndex}].error must define name/message/match.`
          );
        }
      }
      const normalizedTags =
        Array.isArray(tagsRaw) && tagsRaw.every((tag) => typeof tag === 'string' && tag.trim().length > 0)
          ? normalizeCaseTags(tagsRaw.map((tag) => tag.trim()))
          : undefined;
      const normalizedFocus = typeof focusRaw === 'string' && focusRaw.trim().length > 0
        ? focusRaw.trim()
        : undefined;
      const normalizedRefs = normalizeCatalogRefs(refsRaw);
      if (!normalizedTags || normalizedTags.length !== 2) {
        throw new TestEvidenceRuntimeError(
          `testCaseCatalogs[${index}].cases[${caseIndex}] requires tags with exactly 2 axes: [intent, technique].`
        );
      }
      if (!normalizedFocus) {
        throw new TestEvidenceRuntimeError(
          `testCaseCatalogs[${index}].cases[${caseIndex}] requires focus sentence.`
        );
      }
      return {
        id: caseId,
        title: caseTitle,
        ...(description ? { description } : {}),
        input,
        expected,
        ...(expected === 'throws'
          ? {
            error: {
              name: (errorRaw as { name: string }).name,
              message: (errorRaw as { message: string }).message,
              match: (errorRaw as { match: 'equals' | 'contains' }).match
            }
          }
          : { output }),
        tags: normalizedTags,
        focus: normalizedFocus,
        ...(normalizedRefs.length > 0 ? { refs: normalizedRefs } : {})
      };
    });
    const description = typeof catalog.description === 'string' && catalog.description.trim().length > 0
      ? catalog.description.trim()
      : undefined;
    const definitionPath = typeof catalog.definitionPath === 'string' && catalog.definitionPath.trim().length > 0
      ? catalog.definitionPath.trim()
      : undefined;
    const refs = normalizeCatalogRefs(catalog.refs);
    return {
      id,
      title,
      ...(description ? { description } : {}),
      ...(definitionPath ? { definitionPath } : {}),
      ...(refs.length > 0 ? { refs } : {}),
      cases: normalizedCases
    };
  });
}

function flattenTestCaseCatalogs(catalogs: Array<{
  id: string;
  title: string;
  description?: string;
  definitionPath?: string;
  cases: Array<{
    id: string;
    title: string;
    description?: string;
    input?: unknown;
    output?: unknown;
  }>;
}>): TestCaseEvidence[] {
  const rows: TestCaseEvidence[] = [];
  for (const catalog of catalogs) {
    for (const testCase of catalog.cases) {
      rows.push({
        kind: 'test-case',
        id: `${catalog.id}.${testCase.id}`,
        catalogId: catalog.id,
        caseId: testCase.id,
        filePath: 'tests/specs/index',
        title: testCase.title,
        ...(testCase.description ? { description: testCase.description } : {})
      });
    }
  }
  return rows;
}

function readSqlCaseCatalogsFromModule(moduleValue: EvidenceModuleLike): SqlCaseCatalogEvidence[] {
  if (!Array.isArray(moduleValue.sqlCatalogCases)) {
    return [];
  }
  return moduleValue.sqlCatalogCases.map((catalog, index) => normalizeSqlCaseCatalog(catalog, index));
}

function normalizeSqlCaseCatalog(catalog: unknown, index: number): SqlCaseCatalogEvidence {
  if (!isPlainObject(catalog)) {
    throw new TestEvidenceRuntimeError(`sqlCatalogCases[${index}] must be an object in evidence module.`);
  }
  const id = typeof catalog.id === 'string' ? catalog.id.trim() : '';
  const title = typeof catalog.title === 'string' ? catalog.title.trim() : '';
  if (!id || !title) {
    throw new TestEvidenceRuntimeError(`sqlCatalogCases[${index}] requires non-empty id/title.`);
  }
  const details = isPlainObject(catalog.catalog) ? catalog.catalog : {};
  const params = isPlainObject(details.params) ? details.params : {};
  const output = isPlainObject(details.output) ? details.output : {};
  const mapping = isPlainObject(output.mapping) ? output.mapping : {};
  const columnMapRaw = isPlainObject(mapping.columnMap) ? mapping.columnMap : {};
  const columnMap = Object.fromEntries(
    Object.entries(columnMapRaw)
      .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
      .sort((a, b) => a[0].localeCompare(b[0]))
  );
  const sql = typeof details.sql === 'string' ? details.sql : '';
  const example = isPlainObject(params.example) ? { ...params.example } : {};
  const fixturesRaw = Array.isArray(catalog.fixtures) ? catalog.fixtures : [];
  const fixtures = fixturesRaw
    .filter((item) => isPlainObject(item) && typeof item.tableName === 'string')
    .map((item) => ({
      tableName: item.tableName as string,
      ...(isPlainObject(item.schema) && isPlainObject(item.schema.columns)
        ? {
          schema: {
            columns: Object.fromEntries(
              Object.entries(item.schema.columns)
                .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
                .sort((a, b) => a[0].localeCompare(b[0]))
            )
          }
        }
        : {}),
      rowsCount: Array.isArray(item.rows) ? item.rows.length : typeof item.rowsCount === 'number' ? item.rowsCount : 0
    }))
    .sort((a, b) => a.tableName.localeCompare(b.tableName));
  const casesRaw = Array.isArray(catalog.cases) ? catalog.cases : [];
  const baseParams = isPlainObject(params.example) ? { ...params.example } : {};
  const cases = casesRaw
    .filter((item) => isPlainObject(item) && typeof item.id === 'string' && typeof item.title === 'string')
    .map((item, caseIndex) => {
      const arrangedParams = resolveCaseArrangeParams(item, index, caseIndex);
      const mergedParams = arrangedParams ? { ...baseParams, ...arrangedParams } : { ...baseParams };
      const expected = Array.isArray(item.expected) ? [...item.expected] : [];
      return {
        id: item.id as string,
        title: item.title as string,
        params: Object.fromEntries(
          Object.entries(mergedParams)
            .filter((entry): entry is [string, unknown] => typeof entry[0] === 'string')
            .sort((a, b) => a[0].localeCompare(b[0]))
        ),
        expected
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const nestedDefinitionPath = typeof details.definitionPath === 'string' && details.definitionPath.trim().length > 0
    ? details.definitionPath.trim()
    : undefined;
  const description = typeof catalog.description === 'string' && catalog.description.trim().length > 0
    ? catalog.description.trim()
    : undefined;
  const definitionPath = typeof catalog.definitionPath === 'string' && catalog.definitionPath.trim().length > 0
    ? catalog.definitionPath.trim()
    : nestedDefinitionPath;
  return {
    id,
    title,
    ...(description ? { description } : {}),
    ...(definitionPath ? { definitionPath } : {}),
    params: {
      shape: 'named',
      example
    },
    output: {
      mapping: {
        columnMap
      }
    },
    // Keep SQL text unchanged so evidence remains a direct projection of test source.
    sql,
    fixtures,
    cases
  };
}

function resolveCaseArrangeParams(
  testCase: Record<string, unknown>,
  catalogIndex: number,
  caseIndex: number
): Record<string, unknown> | undefined {
  const arrange = testCase.arrange;
  if (arrange === undefined) {
    return undefined;
  }
  if (typeof arrange !== 'function') {
    throw new TestEvidenceRuntimeError(
      `sqlCatalogCases[${catalogIndex}].cases[${caseIndex}].arrange must be a function when provided.`
    );
  }
  const arranged = (arrange as () => unknown)();
  if (!isPlainObject(arranged)) {
    throw new TestEvidenceRuntimeError(
      `sqlCatalogCases[${catalogIndex}].cases[${caseIndex}].arrange must return an object.`
    );
  }
  return arranged;
}

function loadTestCaseCatalogEvidence(rootDir: string, filePath: string): TestCaseEvidence[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new TestEvidenceRuntimeError(
      `Failed to parse test-case catalog file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!isPlainObject(parsed)) {
    throw new TestEvidenceRuntimeError(`Test-case catalog file must contain an object: ${filePath}`);
  }

  const document = parsed as TestCaseCatalogDocumentLike;
  if (!Array.isArray(document.catalogs)) {
    throw new TestEvidenceRuntimeError(`Test-case catalog file must define a catalogs array: ${filePath}`);
  }

  const relative = normalizePath(path.relative(rootDir, filePath));
  const rows: TestCaseEvidence[] = [];
  const catalogs = document.catalogs as TestCaseCatalogLike[];
  for (const catalog of catalogs) {
    const catalogId = typeof catalog.id === 'string' ? catalog.id.trim() : '';
    if (!catalogId) {
      throw new TestEvidenceRuntimeError(`Test-case catalog id must be a non-empty string: ${filePath}`);
    }
    if (!Array.isArray(catalog.cases)) {
      throw new TestEvidenceRuntimeError(`Test-case catalog "${catalogId}" must define a cases array: ${filePath}`);
    }

    const cases = catalog.cases as TestCaseLike[];
    for (const testCase of cases) {
      const caseId = typeof testCase.id === 'string' ? testCase.id.trim() : '';
      const title = typeof testCase.title === 'string' ? testCase.title.trim() : '';
      if (!caseId || !title) {
        throw new TestEvidenceRuntimeError(
          `Test-case catalog "${catalogId}" requires each case to define non-empty id/title: ${filePath}`
        );
      }
      const description = typeof testCase.description === 'string' && testCase.description.trim().length > 0
        ? testCase.description.trim()
        : undefined;
      rows.push({
        kind: 'test-case',
        id: `${catalogId}.${caseId}`,
        catalogId,
        caseId,
        filePath: relative,
        title,
        ...(description ? { description } : {})
      });
    }
  }

  return rows;
}

function walkFiles(rootDir: string, predicate: (absolutePath: string) => boolean): string[] {
  const stack = [rootDir];
  const files: string[] = [];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (entry.isFile() && predicate(absolute)) {
        files.push(absolute);
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function isTestCaseCatalogFile(filePath: string): boolean {
  const lowered = filePath.toLowerCase();
  return lowered.endsWith('.test-case-catalog.json');
}

function normalizePath(input: string): string {
  return input.split(path.sep).join('/');
}

function normalizeCatalogRefs(value: unknown): Array<{ label: string; url: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => isPlainObject(item))
    .map((item) => ({
      label: typeof item.label === 'string' ? item.label.trim() : '',
      url: typeof item.url === 'string' ? item.url.trim() : ''
    }))
    .filter((item) => item.label.length > 0 && item.url.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label) || a.url.localeCompare(b.url));
}

const TAG_NORMALIZATION_MAP: Record<string, string> = {
  boundary: 'bva'
};

const INTENT_TAGS = ['normalization', 'validation', 'authorization', 'invariant'] as const;
const TECHNIQUE_TAGS = ['ep', 'bva', 'idempotence', 'state'] as const;
const INTENT_TAG_SET = new Set<string>(INTENT_TAGS);
const TECHNIQUE_TAG_SET = new Set<string>(TECHNIQUE_TAGS);

function normalizeCaseTags(tags: string[]): string[] {
  const normalized = new Set<string>();
  for (const rawTag of tags) {
    const lowered = rawTag.trim().toLowerCase();
    const mapped = TAG_NORMALIZATION_MAP[lowered] ?? lowered;
    if (INTENT_TAG_SET.has(mapped) || TECHNIQUE_TAG_SET.has(mapped)) {
      normalized.add(mapped);
    }
  }
  const intent = INTENT_TAGS.find((tag) => normalized.has(tag));
  const technique = TECHNIQUE_TAGS.find((tag) => normalized.has(tag));
  const result: string[] = [];
  if (intent) {
    result.push(intent);
  }
  if (technique) {
    result.push(technique);
  }
  return result;
}

function formatCaseTags(tags: string[] | undefined): string {
  const normalized = Array.isArray(tags) ? normalizeCaseTags(tags) : [];
  return `[${normalized.join(', ')}]`;
}

function formatCaseFocus(focus: string | undefined): string {
  if (typeof focus === 'string' && focus.trim().length > 0) {
    return focus.trim();
  }
  return '(not specified)';
}

function stringifyStablePretty(value: unknown): string {
  return JSON.stringify(sortDeep(value), null, 2) ?? 'null';
}

function stringifyErrorPretty(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return 'null';
  }
  const source = value as Record<string, unknown>;
  return JSON.stringify(
    {
      name: source.name,
      message: source.message,
      match: source.match
    },
    null,
    2
  ) ?? 'null';
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortDeep(item));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, nested]) => [key, sortDeep(nested)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}








/**
 * Render deterministic Markdown focused on human-readable test intent.
 */
export function formatTestDocumentationOutput(
  report: TestSpecificationEvidence,
  context?: { markdownPath?: string; sourceRootDir?: string }
): string {
  const model = buildSpecificationModel(report as TestEvidencePreviewJson);
  return `${renderTestDocumentationMarkdown(model, {
    definitionLinks: resolveDefinitionLinkOptions(context)
  })}\n`;
}

function writeTestDocumentationArtifact(args: {
  report: TestSpecificationEvidence;
  outPath: string;
  sourceRootDir: string;
}): void {
  mkdirSync(path.dirname(args.outPath), { recursive: true });
  writeFileSync(
    args.outPath,
    formatTestDocumentationOutput(args.report, {
      markdownPath: args.outPath,
      sourceRootDir: args.sourceRootDir
    }),
    'utf8'
  );
  console.log(`wrote: ${args.outPath}`);
}
