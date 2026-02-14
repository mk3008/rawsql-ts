import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { BinarySelectQuery, ColumnReference, DeleteQuery, MultiQuerySplitter, SimpleSelectQuery, SqlParser, UpdateQuery } from 'rawsql-ts';

export type CheckFormat = 'human' | 'json';
export type ViolationSeverity = 'error' | 'warning';

/** A single deterministic contract-check violation/warning item. */
export interface ContractViolation {
  rule:
    | 'duplicate-spec-id'
    | 'unresolved-sql-file'
    | 'params-shape-mismatch'
    | 'mapping-invalid-entry'
    | 'mapping-duplicate-entry'
    | 'safety-select-star'
    | 'safety-missing-where'
    | 'sql-parse-error';
  severity: ViolationSeverity;
  specId: string;
  filePath: string;
  message: string;
}

export interface CheckContractResult {
  ok: boolean;
  violations: ContractViolation[];
  filesChecked: number;
  specsChecked: number;
}

/**
 * Resolve command exit code for contract checks.
 * @param args.result Completed check result when execution succeeded.
 * @param args.error Error thrown while running checks.
 * @returns 0 when result is ok, 1 when violations exist or non-runtime errors occur, 2 for runtime/config errors.
 */
export function resolveCheckContractExitCode(args: {
  result?: CheckContractResult;
  error?: unknown;
}): 0 | 1 | 2 {
  if (args.error) {
    return args.error instanceof CheckContractRuntimeError ? 2 : 1;
  }
  if (!args.result) {
    return 2;
  }
  return args.result.ok ? 0 : 1;
}

interface QuerySpecLike {
  id?: unknown;
  sqlFile?: unknown;
  params?: {
    shape?: unknown;
    example?: unknown;
  };
  output?: {
    mapping?: {
      prefix?: unknown;
      columnMap?: unknown;
    };
  };
}

interface LoadedSpec {
  spec: QuerySpecLike;
  filePath: string;
}

/** Runtime/configuration error for contract check command (maps to exit code 2). */
export class CheckContractRuntimeError extends Error {
  readonly exitCode = 2;
}

interface CheckCommandOptions {
  format?: 'json';
  out?: string;
  strict?: boolean;
  specsDir?: string;
}

/** Register `ztd check contract` command on the CLI root program. */
export function registerCheckContractCommand(program: Command): void {
  const check = program.command('check').description('Contract validation workflows');

  check
    .command('contract')
    .description('Check SQL contract specs deterministically')
    .option('--format <format>', 'Output format (json)', 'human')
    .option('--out <path>', 'Write output to file')
    .option('--strict', 'Treat safety warnings as violations')
    .option('--specs-dir <path>', 'Override specs directory (default: src/catalog/specs)')
    .action(async (options: CheckCommandOptions & { format: string }) => {
      const format = normalizeFormat(options.format);
      const result = runCheckContract({
        strict: Boolean(options.strict),
        rootDir: process.env.ZTD_PROJECT_ROOT,
        specsDir: options.specsDir
      });
      const text = formatOutput(result, format);
      if (options.out) {
        const absolute = path.resolve(process.cwd(), options.out);
        mkdirSync(path.dirname(absolute), { recursive: true });
        writeFileSync(absolute, text, 'utf8');
      } else {
        const writer = result.ok ? console.log : console.error;
        writer(text);
      }
      process.exitCode = resolveCheckContractExitCode({ result });
    });
}

function normalizeFormat(format: string): CheckFormat {
  const normalized = format.trim().toLowerCase();
  if (normalized === 'human') {
    return 'human';
  }
  if (normalized === 'json') {
    return 'json';
  }
  throw new CheckContractRuntimeError(`Unsupported format: ${format}`);
}

/**
 * Run deterministic contract checks for catalog specs under a project root.
 * @param options.strict Treat safety checks as errors when true, warnings otherwise.
 * @param options.rootDir Optional project root override.
 * @param options.specsDir Optional specs directory override (relative to rootDir).
 */
export function runCheckContract(options: { strict: boolean; rootDir?: string; specsDir?: string }): CheckContractResult {
  const root = path.resolve(options.rootDir ?? process.cwd());
  const specsDir = options.specsDir ? path.resolve(root, options.specsDir) : path.resolve(root, 'src', 'catalog', 'specs');
  if (!existsSync(specsDir)) {
    throw new CheckContractRuntimeError(`Spec directory not found: ${specsDir}`);
  }

  const specFiles = walkSpecFiles(specsDir);
  const loadedSpecs = specFiles.flatMap((filePath) => loadSpecsFromFile(filePath));
  const violations: ContractViolation[] = [];

  const duplicateMap = new Map<string, LoadedSpec[]>();
  for (const loaded of loadedSpecs) {
    const id = typeof loaded.spec.id === 'string' ? loaded.spec.id.trim() : '';
    if (!id) {
      continue;
    }
    const list = duplicateMap.get(id) ?? [];
    list.push(loaded);
    duplicateMap.set(id, list);
  }
  for (const [id, entries] of Array.from(duplicateMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (entries.length < 2) {
      continue;
    }
    for (const entry of entries.sort((a, b) => a.filePath.localeCompare(b.filePath))) {
      violations.push({
        rule: 'duplicate-spec-id',
        severity: 'error',
        specId: id,
        filePath: entry.filePath,
        message: `Duplicate spec.id "${id}" detected.`
      });
    }
  }

  for (const loaded of loadedSpecs.sort((a, b) => {
    const idA = typeof a.spec.id === 'string' ? a.spec.id : '';
    const idB = typeof b.spec.id === 'string' ? b.spec.id : '';
    return idA.localeCompare(idB) || a.filePath.localeCompare(b.filePath);
  })) {
    const specId = typeof loaded.spec.id === 'string' && loaded.spec.id.trim().length > 0
      ? loaded.spec.id.trim()
      : '<missing-id>';

    if (typeof loaded.spec.sqlFile !== 'string' || loaded.spec.sqlFile.trim().length === 0) {
      violations.push({
        rule: 'unresolved-sql-file',
        severity: 'error',
        specId,
        filePath: loaded.filePath,
        message: 'spec.sqlFile must be a non-empty string.'
      });
    } else {
      const sqlPath = path.resolve(path.dirname(loaded.filePath), loaded.spec.sqlFile);
      if (!existsSync(sqlPath)) {
        violations.push({
          rule: 'unresolved-sql-file',
          severity: 'error',
          specId,
          filePath: loaded.filePath,
          message: `SQL file does not exist: ${loaded.spec.sqlFile}`
        });
      } else {
        applySafetyChecks(sqlPath, specId, loaded.filePath, options.strict, violations);
      }
    }

    const shape = loaded.spec.params?.shape;
    const example = loaded.spec.params?.example;
    if (shape === 'positional' && !Array.isArray(example)) {
      violations.push({
        rule: 'params-shape-mismatch',
        severity: 'error',
        specId,
        filePath: loaded.filePath,
        message: 'params.shape="positional" requires params.example to be an array.'
      });
    } else if (shape === 'named' && !isPlainObject(example)) {
      violations.push({
        rule: 'params-shape-mismatch',
        severity: 'error',
        specId,
        filePath: loaded.filePath,
        message: 'params.shape="named" requires params.example to be an object.'
      });
    }

    const mapping = loaded.spec.output?.mapping;
    if (mapping) {
      validateMapping(specId, loaded.filePath, mapping, violations);
    }
  }

  const sorted = violations.sort((a, b) =>
    a.rule.localeCompare(b.rule) ||
    a.specId.localeCompare(b.specId) ||
    a.filePath.localeCompare(b.filePath) ||
    a.message.localeCompare(b.message)
  );

  return {
    ok: sorted.length === 0 || sorted.every((item) => item.severity === 'warning'),
    violations: sorted,
    filesChecked: specFiles.length,
    specsChecked: loadedSpecs.length
  };
}

function applySafetyChecks(
  sqlPath: string,
  specId: string,
  specFilePath: string,
  strict: boolean,
  violations: ContractViolation[]
): void {
  const sql = readFileSync(sqlPath, 'utf8');
  const chunks = MultiQuerySplitter.split(sql).queries.filter((item) => !item.isEmpty);
  for (const chunk of chunks) {
    const statement = chunk.sql.trim();
    if (!statement) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = SqlParser.parse(statement);
    } catch (error) {
      violations.push({
        rule: 'sql-parse-error',
        severity: 'warning',
        specId,
        filePath: specFilePath,
        message: `SQL parse failed in safety check: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    const severity: ViolationSeverity = strict ? 'error' : 'warning';

    if (parsed instanceof UpdateQuery || parsed instanceof DeleteQuery) {
      if (!parsed.whereClause) {
        violations.push({
          rule: 'safety-missing-where',
          severity,
          specId,
          filePath: specFilePath,
          message: 'UPDATE/DELETE statement without WHERE detected.'
        });
      }
      continue;
    }

    if (hasRootLevelSelectWildcard(parsed)) {
      violations.push({
        rule: 'safety-select-star',
        severity,
        specId,
        filePath: specFilePath,
        message: 'SELECT * detected at root query level.'
      });
    }
  }
}

function hasRootLevelSelectWildcard(parsed: unknown): boolean {
  if (parsed instanceof SimpleSelectQuery) {
    return parsed.selectClause.items.some((item) => isWildcardSelectItem(item.value));
  }

  if (parsed instanceof BinarySelectQuery) {
    return hasRootLevelSelectWildcard(parsed.left) || hasRootLevelSelectWildcard(parsed.right);
  }

  return false;
}

function isWildcardSelectItem(value: unknown): boolean {
  return value instanceof ColumnReference && value.column.name === '*';
}

function validateMapping(
  specId: string,
  filePath: string,
  mapping: { prefix?: unknown; columnMap?: unknown },
  violations: ContractViolation[]
): void {
  const hasPrefix = typeof mapping.prefix === 'string' && mapping.prefix.trim().length > 0;
  if (!hasPrefix && mapping.columnMap === undefined) {
    violations.push({
      rule: 'mapping-invalid-entry',
      severity: 'error',
      specId,
      filePath,
      message: 'output.mapping must provide prefix or columnMap.'
    });
    return;
  }

  if (mapping.columnMap === undefined) {
    return;
  }

  if (!isPlainObject(mapping.columnMap)) {
    violations.push({
      rule: 'mapping-invalid-entry',
      severity: 'error',
      specId,
      filePath,
      message: 'output.mapping.columnMap must be an object when provided.'
    });
    return;
  }

  const seenColumns = new Map<string, string>();
  for (const key of Object.keys(mapping.columnMap).sort()) {
    const value = mapping.columnMap[key];
    if (!key.trim()) {
      violations.push({
        rule: 'mapping-invalid-entry',
        severity: 'error',
        specId,
        filePath,
        message: 'output.mapping.columnMap keys must be non-empty strings.'
      });
      continue;
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      violations.push({
        rule: 'mapping-invalid-entry',
        severity: 'error',
        specId,
        filePath,
        message: `output.mapping.columnMap["${key}"] must be a non-empty string.`
      });
      continue;
    }
    const normalized = value.trim();
    const prev = seenColumns.get(normalized);
    if (prev) {
      violations.push({
        rule: 'mapping-duplicate-entry',
        severity: 'error',
        specId,
        filePath,
        message: `Duplicate mapped column "${normalized}" for keys "${prev}" and "${key}".`
      });
      continue;
    }
    seenColumns.set(normalized, key);
  }
}

function loadSpecsFromFile(filePath: string): LoadedSpec[] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new CheckContractRuntimeError(
        `Failed to parse spec file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (Array.isArray(parsed)) {
      return parsed.map((spec) => ({ spec: (spec as QuerySpecLike), filePath }));
    }
    if (isPlainObject(parsed) && Array.isArray((parsed as Record<string, unknown>).specs)) {
      const specs = (parsed as { specs: unknown[] }).specs;
      return specs.map((spec) => ({ spec: (spec as QuerySpecLike), filePath }));
    }
    if (isPlainObject(parsed)) {
      return [{ spec: parsed as QuerySpecLike, filePath }];
    }

    throw new CheckContractRuntimeError(`Unsupported spec format in ${filePath}`);
  }

  const source = readFileSync(filePath, 'utf8');
  // Intentionally lightweight extraction for TS/JS specs (MVP):
  // - expects object-literal style `id` + `sqlFile`
  // - does not fully parse TS syntax/semantics
  // Prefer JSON specs for strict machine-readability.
  const blocks = source.match(/\{[\s\S]*?id\s*:\s*['"`][^'"`]+['"`][\s\S]*?sqlFile\s*:\s*['"`][^'"`]+['"`][\s\S]*?\}/g) ?? [];
  return blocks.map((block) => {
    const id = block.match(/id\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
    const sqlFile = block.match(/sqlFile\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
    const shape = block.match(/shape\s*:\s*['"`](positional|named)['"`]/)?.[1];
    const exampleIsArray = /example\s*:\s*\[/.test(block);
    const exampleIsObject = /example\s*:\s*\{/.test(block);

    const columnMapBlock = block.match(/columnMap\s*:\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const columnMap: Record<string, unknown> = {};
    for (const match of Array.from(columnMapBlock.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*['"`]([^'"`]+)['"`]/g))) {
      columnMap[match[1]] = match[2];
    }

    return {
      spec: {
        id,
        sqlFile,
        params: {
          shape,
          example: exampleIsArray ? [] : exampleIsObject ? {} : undefined
        },
        output: Object.keys(columnMap).length > 0 ? { mapping: { columnMap } } : undefined
      } as QuerySpecLike,
      filePath
    };
  });
}

function walkSpecFiles(rootDir: string): string[] {
  const files: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        if (name.endsWith('.json') || name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.mts') || name.endsWith('.cts')) {
          files.push(absolute);
        }
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Format check results into human text or deterministic JSON text. */
export function formatOutput(result: CheckContractResult, format: CheckFormat): string {
  if (format === 'json') {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  if (result.violations.length === 0) {
    return `contract check passed (${result.specsChecked} specs in ${result.filesChecked} files)`;
  }

  const lines: string[] = [];
  lines.push(`contract check found ${result.violations.length} violation(s)`);
  for (const item of result.violations) {
    lines.push(`- [${item.severity}] ${item.rule} ${item.specId} @ ${item.filePath}`);
    lines.push(`  ${item.message}`);
  }
  return lines.join('\n');
}
