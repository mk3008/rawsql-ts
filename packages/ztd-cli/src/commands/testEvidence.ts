import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Command } from 'commander';
import {
  buildDiffJson,
  renderDiffMarkdown,
  stableStringify as coreStableStringify,
  type DiffCase as CorePrDiffCase,
  type DiffCatalog as CorePrDiffCatalog,
  type DiffJson as CoreTestSpecificationPrDiff,
  type RemovedDetailLevel,
  type PreviewJson as TestEvidencePreviewJson
} from '@rawsql-ts/test-evidence-core';

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
  cases: Array<{
    id: string;
    title: string;
    description?: string;
    input?: unknown;
    output?: unknown;
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
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
}

interface TestEvidencePrCommandOptions {
  base?: string;
  head?: string;
  baseMode?: string;
  allowEmptyBase?: boolean;
  removedDetail?: string;
  outDir?: string;
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
}

interface QuerySpecLike {
  id?: unknown;
  sqlFile?: unknown;
  params?: {
    shape?: unknown;
  };
  output?: {
    mapping?: unknown;
  };
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
    .option('--specs-dir <path>', 'Override SQL catalog specs directory (default: src/catalog/specs)')
    .option('--tests-dir <path>', 'Override tests directory (default: tests)')
    .option('--spec-module <path>', 'Explicit evidence module path (default: tests/specs/index)')
    .action((options: TestEvidenceCommandOptions) => {
      try {
        const mode = normalizeMode(options.mode);
        const format = normalizeFormat(options.format);
        const report = runTestEvidenceSpecification({
          mode,
          rootDir: process.env.ZTD_PROJECT_ROOT,
          specsDir: options.specsDir,
          testsDir: options.testsDir,
          specModule: options.specModule
        });
        writeArtifacts({
          report,
          format,
          outDir: path.resolve(process.cwd(), options.outDir)
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
    .option('--specs-dir <path>', 'Override SQL catalog specs directory (default: src/catalog/specs)')
    .option('--tests-dir <path>', 'Override tests directory (default: tests)')
    .option('--spec-module <path>', 'Explicit evidence module path (default: tests/specs/index)')
    .action((options: TestEvidencePrCommandOptions) => {
      try {
        const output = runTestEvidencePr({
          baseRef: options.base ?? 'main',
          headRef: options.head ?? 'HEAD',
          baseMode: normalizeBaseMode(options.baseMode ?? 'merge-base'),
          allowEmptyBase: Boolean(options.allowEmptyBase),
          removedDetail: normalizeRemovedDetail(options.removedDetail ?? 'input'),
          outDir: options.outDir ?? 'artifacts/test-evidence',
          rootDir: process.env.ZTD_PROJECT_ROOT,
          specsDir: options.specsDir,
          testsDir: options.testsDir,
          specModule: options.specModule
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
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
}): TestSpecificationEvidence {
  const root = path.resolve(options.rootDir ?? process.cwd());
  const specsDir = options.specsDir ? path.resolve(root, options.specsDir) : path.resolve(root, 'src', 'catalog', 'specs');
  const testsDir = options.testsDir ? path.resolve(root, options.testsDir) : path.resolve(root, 'tests');

  const sqlSpecFiles = existsSync(specsDir) ? walkFiles(specsDir, isSpecLikeFile) : [];
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
      `No catalog specs or test-case evidence exports were found. Checked specsDir=${specsDir}, testsDir=${testsDir}`,
      { code: 'NO_SPECS_FOUND' }
    );
  }

  const sqlCatalogs = sqlSpecFiles
    .flatMap((filePath) => loadSpecsFromFile(filePath))
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

/**
 * Render deterministic JSON or Markdown output text.
 */
export function formatTestEvidenceOutput(report: TestSpecificationEvidence, format: Exclude<TestEvidenceFormat, 'both'>): string {
  if (format === 'json') {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  const sqlTestsCount = report.sqlCaseCatalogs.reduce((total, catalog) => total + catalog.cases.length, 0);
  const functionTestsCount = report.testCaseCatalogs.reduce((total, catalog) => total + catalog.cases.length, 0);
  const totalCatalogCount = report.sqlCaseCatalogs.length + report.testCaseCatalogs.length;
  const lines: string[] = [];
  lines.push('# Test Evidence Preview');
  lines.push('');
  lines.push(`- catalogs: ${totalCatalogCount}`);
  lines.push(`- tests: ${sqlTestsCount + functionTestsCount}`);
  lines.push('');
  for (const catalog of report.sqlCaseCatalogs) {
    lines.push(`## ${catalog.id} — ${catalog.title}`);
    lines.push(`- definition: ${catalog.definitionPath ? `\`${catalog.definitionPath}\`` : '(unknown)'}`);
    lines.push('- fixtures:');
    for (const fixture of catalog.fixtures) {
      lines.push(`  - ${fixture.tableName}`);
    }
    lines.push('');
    for (const [index, testCase] of catalog.cases.entries()) {
      lines.push(`### ${testCase.id} — ${testCase.title}`);
      lines.push('input:');
      lines.push('```json');
      lines.push(JSON.stringify(testCase.params, null, 2));
      lines.push('```');
      lines.push('output:');
      lines.push('```json');
      lines.push(JSON.stringify(testCase.expected, null, 2));
      lines.push('```');
      lines.push('');
      if (index < catalog.cases.length - 1) {
        lines.push('---');
        lines.push('');
      }
    }
  }
  for (const catalog of report.testCaseCatalogs) {
    lines.push(`## ${catalog.id} — ${catalog.title}`);
    lines.push(`- definition: ${catalog.definitionPath ? `\`${catalog.definitionPath}\`` : '(unknown)'}`);
    lines.push('');
    for (const [index, testCase] of catalog.cases.entries()) {
      lines.push(`### ${testCase.id} — ${testCase.title}`);
      lines.push('input:');
      lines.push('```json');
      lines.push(JSON.stringify(testCase.input, null, 2));
      lines.push('```');
      lines.push('output:');
      lines.push('```json');
      lines.push(JSON.stringify(testCase.output, null, 2));
      lines.push('```');
      lines.push('');
      if (index < catalog.cases.length - 1) {
        lines.push('---');
        lines.push('');
      }
    }
  }
  lines.push('');
  return lines.join('\n');
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
  options?: { removedDetail?: RemovedDetailLevel }
): string {
  void options;
  return renderDiffMarkdown(diff);
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
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
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
      specModule: options.specModule
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
      specModule: options.specModule
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
    writeFileSync(diffMdPath, formatTestEvidencePrMarkdown(diff, { removedDetail: options.removedDetail }), 'utf8');
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
}): void {
  mkdirSync(args.outDir, { recursive: true });
  const writtenFiles: string[] = [];

  if (args.format === 'json' || args.format === 'both') {
    const jsonPath = path.join(args.outDir, 'test-specification.json');
    writeFileSync(jsonPath, formatTestEvidenceOutput(args.report, 'json'), 'utf8');
    writtenFiles.push(jsonPath);
  }

  if (args.format === 'markdown' || args.format === 'both') {
    const mdPath = path.join(args.outDir, 'test-specification.md');
    writeFileSync(mdPath, formatTestEvidenceOutput(args.report, 'markdown'), 'utf8');
    writtenFiles.push(mdPath);
  }

  for (const filePath of writtenFiles.sort((a, b) => a.localeCompare(b))) {
    console.log(`wrote: ${filePath}`);
  }
}

function materializeEvidenceForRef(args: {
  repoRoot: string;
  ref: string;
  resolvedSha: string;
  allowCurrentWorkspace: boolean;
  tempRoot: string;
  createdWorktrees: string[];
  specsDir?: string;
  testsDir?: string;
  specModule?: string;
}): { sha: string; report: TestSpecificationEvidence; previewJsonPath: string } {
  const toReport = (rootDir: string): TestSpecificationEvidence => {
    try {
      return runTestEvidenceSpecification({
        mode: 'specification',
        rootDir,
        specsDir: args.specsDir,
        testsDir: args.testsDir,
        specModule: args.specModule
      });
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
  loaded: { filePath: string; spec: QuerySpecLike }
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

function loadSpecsFromFile(filePath: string): Array<{ filePath: string; spec: QuerySpecLike }> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new TestEvidenceRuntimeError(
        `Failed to parse spec file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (Array.isArray(parsed)) {
      return parsed.map((spec) => ({ spec: spec as QuerySpecLike, filePath }));
    }
    if (isPlainObject(parsed) && Array.isArray((parsed as Record<string, unknown>).specs)) {
      return ((parsed as { specs: unknown[] }).specs).map((spec) => ({ spec: spec as QuerySpecLike, filePath }));
    }
    if (isPlainObject(parsed)) {
      return [{ spec: parsed as QuerySpecLike, filePath }];
    }
    return [];
  }

  const source = readFileSync(filePath, 'utf8');
  const blocks = extractTsJsSpecBlocks(source);
  return blocks.map((block) => ({
    filePath,
    spec: {
      id: block.match(/id\s*:\s*['"`]([^'"`]+)['"`]/)?.[1],
      sqlFile: block.match(/sqlFile\s*:\s*['"`]([^'"`]+)['"`]/)?.[1],
      params: {
        shape: block.match(/shape\s*:\s*['"`](positional|named)['"`]/)?.[1]
      },
      output: /mapping\s*:/.test(block) ? { mapping: {} } : undefined
    }
  }));
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
  cases: Array<{
    id: string;
    title: string;
    description?: string;
    input?: unknown;
    output?: unknown;
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
      const evidenceValue = Object.prototype.hasOwnProperty.call(item, 'evidence') ? item.evidence : undefined;
      const hasEvidence = isPlainObject(evidenceValue);

      // Accept both normalized evidence shape (`input`/`output`) and raw test catalog shape (`evidence.input`/`evidence.output`).
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
      if (input === undefined || output === undefined) {
        throw new TestEvidenceRuntimeError(
          `testCaseCatalogs[${index}].cases[${caseIndex}] requires input/output evidence fields.`
        );
      }
      return {
        id: caseId,
        title: caseTitle,
        ...(description ? { description } : {}),
        input,
        output
      };
    });
    const description = typeof catalog.description === 'string' && catalog.description.trim().length > 0
      ? catalog.description.trim()
      : undefined;
    const definitionPath = typeof catalog.definitionPath === 'string' && catalog.definitionPath.trim().length > 0
      ? catalog.definitionPath.trim()
      : undefined;
    return {
      id,
      title,
      ...(description ? { description } : {}),
      ...(definitionPath ? { definitionPath } : {}),
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

  const description = typeof catalog.description === 'string' && catalog.description.trim().length > 0
    ? catalog.description.trim()
    : undefined;
  return {
    id,
    title,
    ...(description ? { description } : {}),
    ...(typeof catalog.definitionPath === 'string' && catalog.definitionPath.trim().length > 0
      ? { definitionPath: catalog.definitionPath.trim() }
      : {}),
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

function extractTsJsSpecBlocks(source: string): string[] {
  const blocks: string[] = [];
  const seen = new Set<string>();
  const idRegex = /id\s*:\s*['"`][^'"`]+['"`]/g;

  for (const match of Array.from(source.matchAll(idRegex))) {
    if (typeof match.index !== 'number') {
      continue;
    }
    const start = source.lastIndexOf('{', match.index);
    if (start < 0) {
      continue;
    }

    let depth = 0;
    let end = -1;
    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) {
      continue;
    }
    const block = source.slice(start, end + 1);
    if (!/sqlFile\s*:\s*['"`][^'"`]+['"`]/.test(block)) {
      continue;
    }
    if (!seen.has(block)) {
      seen.add(block);
      blocks.push(block);
    }
  }

  return blocks;
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

function isSpecLikeFile(filePath: string): boolean {
  const lowered = filePath.toLowerCase();
  return lowered.endsWith('.json') || lowered.endsWith('.ts') || lowered.endsWith('.js') || lowered.endsWith('.mts') || lowered.endsWith('.cts');
}

function isTestCaseCatalogFile(filePath: string): boolean {
  const lowered = filePath.toLowerCase();
  return lowered.endsWith('.test-case-catalog.json');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizePath(input: string): string {
  return input.split(path.sep).join('/');
}
