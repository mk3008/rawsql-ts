import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';

export type TestEvidenceMode = 'specification';
export type TestEvidenceFormat = 'json' | 'markdown' | 'both';

export interface SqlCatalogSpecEvidence {
  kind: 'sql-catalog';
  id: string;
  specFile: string;
  sqlFile: string | null;
  sqlFileResolved: boolean;
  paramsShape: 'named' | 'positional' | 'unknown';
  hasOutputMapping: boolean;
}

export interface TestCaseEvidence {
  kind: 'test-case';
  id: string;
  catalogId: string;
  caseId: string;
  filePath: string;
  title: string;
  description?: string;
}

export interface TestSpecificationEvidence {
  schemaVersion: 1;
  mode: TestEvidenceMode;
  summary: {
    sqlCatalogCount: number;
    testCaseCount: number;
    specFilesScanned: number;
    testFilesScanned: number;
  };
  sqlCatalogs: SqlCatalogSpecEvidence[];
  testCases: TestCaseEvidence[];
}

interface TestEvidenceCommandOptions {
  mode: string;
  format: string;
  outDir: string;
  specsDir?: string;
  testsDir?: string;
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

/**
 * Runtime/configuration error for test evidence command (maps to exit code 2).
 */
export class TestEvidenceRuntimeError extends Error {
  readonly exitCode = 2;
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
  program
    .command('evidence')
    .description('Generate deterministic test specification evidence artifacts')
    .option('--mode <mode>', 'Evidence mode (specification)', 'specification')
    .option('--format <format>', 'Output format (json|markdown|both)', 'both')
    .option('--out-dir <path>', 'Output directory', '.ztd/test-evidence')
    .option('--specs-dir <path>', 'Override SQL catalog specs directory (default: src/catalog/specs)')
    .option('--tests-dir <path>', 'Override tests directory (default: tests)')
    .action((options: TestEvidenceCommandOptions) => {
      try {
        const mode = normalizeMode(options.mode);
        const format = normalizeFormat(options.format);
        const report = runTestEvidenceSpecification({
          mode,
          rootDir: process.env.ZTD_PROJECT_ROOT,
          specsDir: options.specsDir,
          testsDir: options.testsDir
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

/**
 * Build deterministic specification evidence from SQL catalog specs and test-case catalog exports.
 */
export function runTestEvidenceSpecification(options: {
  mode: TestEvidenceMode;
  rootDir?: string;
  specsDir?: string;
  testsDir?: string;
}): TestSpecificationEvidence {
  const root = path.resolve(options.rootDir ?? process.cwd());
  const specsDir = options.specsDir ? path.resolve(root, options.specsDir) : path.resolve(root, 'src', 'catalog', 'specs');
  const testsDir = options.testsDir ? path.resolve(root, options.testsDir) : path.resolve(root, 'tests');

  const sqlSpecFiles = existsSync(specsDir) ? walkFiles(specsDir, isSpecLikeFile) : [];
  const testCaseCatalogFiles = existsSync(testsDir) ? walkFiles(testsDir, isTestCaseCatalogFile) : [];
  if (sqlSpecFiles.length === 0 && testCaseCatalogFiles.length === 0) {
    throw new TestEvidenceRuntimeError(
      `No catalog specs or test-case catalog exports were found. Checked specsDir=${specsDir}, testsDir=${testsDir}`
    );
  }

  const sqlCatalogs = sqlSpecFiles
    .flatMap((filePath) => loadSpecsFromFile(filePath))
    .map((loaded) => toSqlEvidence(root, loaded))
    .sort((a, b) => a.id.localeCompare(b.id) || a.specFile.localeCompare(b.specFile));

  const testCases = testCaseCatalogFiles
    .flatMap((filePath) => loadTestCaseCatalogEvidence(root, filePath))
    .sort((a, b) => a.id.localeCompare(b.id) || a.filePath.localeCompare(b.filePath));

  return {
    schemaVersion: 1,
    mode: options.mode,
    summary: {
      sqlCatalogCount: sqlCatalogs.length,
      testCaseCount: testCases.length,
      specFilesScanned: sqlSpecFiles.length,
      testFilesScanned: testCaseCatalogFiles.length
    },
    sqlCatalogs,
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

  const lines: string[] = [];
  lines.push('# Test Evidence (Specification Mode)');
  lines.push('');
  lines.push(`- SQL catalogs: ${report.summary.sqlCatalogCount}`);
  lines.push(`- Test cases: ${report.summary.testCaseCount}`);
  lines.push(`- Spec files scanned: ${report.summary.specFilesScanned}`);
  lines.push(`- Test case catalog files scanned: ${report.summary.testFilesScanned}`);
  lines.push('');
  lines.push('## SQL Catalogs');
  if (report.sqlCatalogs.length === 0) {
    lines.push('- (none)');
  } else {
    for (const item of report.sqlCatalogs) {
      const sqlInfo = item.sqlFile === null ? '(missing)' : item.sqlFileResolved ? item.sqlFile : `${item.sqlFile} (missing)`;
      lines.push(`- \`${item.id}\` | params=${item.paramsShape} | sql=${sqlInfo} | spec=${item.specFile}`);
    }
  }
  lines.push('');
  lines.push('## Test Cases');
  if (report.testCases.length === 0) {
    lines.push('- (none)');
  } else {
    for (const item of report.testCases) {
      lines.push(`- \`${item.id}\` | file=${item.filePath}`);
    }
  }
  lines.push('');
  return lines.join('\n');
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
