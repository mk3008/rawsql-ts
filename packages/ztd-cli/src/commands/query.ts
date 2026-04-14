import { Command, Option } from 'commander';
import { createTwoFilesPatch } from 'diff';
import { applyQueryOutputControls, formatQueryUsageReport } from '../query/format';
import { applyQueryPatch } from '../query/patch';
import { buildQueryLintReport, formatQueryLintReport, type QueryLintFormat } from '../query/lint';
import {
  buildQueryPipelinePlan,
  formatQueryPipelinePlan,
  type QueryPipelinePlanFormat
} from '../query/planner';
import { buildQueryUsageReport, writeQueryUsageOutput } from '../query/report';
import {
  buildObservedSqlMatchReport,
  formatObservedSqlMatchReport
} from '@rawsql-ts/sql-grep-core';
import { buildQuerySliceReport } from '../query/slice';
import {
  buildQueryStructureReport,
  formatQueryStructureReport,
  type QueryStructureFormat
} from '../query/structure';
import { getAgentOutputFormat, isJsonOutput, parseJsonPayload, writeCommandEnvelope } from '../utils/agentCli';
import { withSpanSync } from '../utils/telemetry';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  collectSupportedOptionalConditionBranches,
  SelectQueryParser,
  SSSQLFilterBuilder,
  type SssqlBranchInfo,
  type SssqlBranchKind,
  type SssqlRemoveSpec,
  type SssqlScaffoldSpec,
  type SssqlScaffoldFilters,
  SqlFormatter
} from 'rawsql-ts';

interface QueryUsesOptions {
  format?: string;
  scopeDir?: string;
  sqlRoot?: string;
  excludeGenerated?: boolean;
  out?: string;
  view?: string;
  anySchema?: boolean;
  anyTable?: boolean;
  summaryOnly?: boolean;
  limit?: string;
  json?: string;
  target?: string;
}

interface QueryStructureOptions {
  format?: string;
  out?: string;
}

interface QueryPlanOptions {
  format?: string;
  out?: string;
  material?: unknown;
  scalarFilterColumns?: unknown;
  scalarFilterColumn?: unknown;
  json?: string;
}
interface QuerySliceOptions {
  cte?: string;
  final?: boolean;
  out?: string;
  limit?: string;
}

interface QueryPatchApplyOptions {
  cte?: string;
  from?: string;
  out?: string;
  preview?: boolean;
}

interface QuerySssqlScaffoldOptions {
  format?: string;
  out?: string;
  json?: string;
  preview?: boolean;
  filter?: unknown;
  filters?: Record<string, unknown>;
  parameter?: string;
  operator?: string;
  kind?: string;
  query?: string;
  queryFile?: string;
  anchorColumns?: unknown;
  anchorColumn?: unknown;
}

interface QuerySssqlRefreshOptions {
  format?: string;
  out?: string;
  json?: string;
  preview?: boolean;
}

interface QuerySssqlListOptions {
  format?: string;
  out?: string;
  json?: string;
}

interface QuerySssqlRemoveOptions {
  format?: string;
  out?: string;
  json?: string;
  preview?: boolean;
  all?: boolean;
  parameter?: string;
  kind?: string;
  operator?: string;
  target?: string;
}

interface QueryMatchObservedOptions {
  format?: string;
  out?: string;
  sql?: string;
  sqlFile?: string;
}

interface QueryLintOptions {
  format?: string;
  out?: string;
  rules?: string;
}

export const QUERY_USES_COMMAND_SPANS = {
  resolveOptions: 'resolve-query-options',
  renderOutput: 'render-query-usage-output',
} as const;

const QUERY_SCOPE_DIR_HELP = 'Limit discovery to one boundary or QuerySpec subtree instead of scanning the whole project';

/**
 * Register strict-first impact investigation commands on the CLI root.
 */
export function registerQueryCommands(program: Command): void {
  const query = program.command('query').description('Impact investigation for project QuerySpec-backed SQL assets');
  query.addHelpText(
    'after',
    `
Examples:
  $ ztd query uses table public.users
  $ ztd query uses column public.users.email
  $ ztd query uses column public.users.email --view detail
  $ ztd query uses column users.email --any-schema --format json
  $ ztd query uses column email --any-schema --any-table --format json
  $ ztd query outline large_query.sql
  $ ztd query graph large_query.sql --format dot
  $ ztd query slice large_query.sql --cte purchase_summary
  $ ztd query plan large_query.sql --material base_cte --scalar-filter-column sale_date --format json
  $ ztd query patch apply large_query.sql --cte purchase_summary --from edited_slice.sql --preview
  $ ztd query lint large_query.sql --format json
  $ ztd query match-observed --sql-file observed.sql --format json

Notes:
  - Strict mode is the default. Relaxed modes are explicit opt-in only.
  - Impact is the default view. Use --view detail for edit-ready locations/snippets.
  - Impact representatives may omit select snippets; use --view detail for edit-ready SELECT occurrences.
  - Project-wide discovery is the default. query uses scans QuerySpec entries discovered under the current project root.
  - Use --scope-dir only to narrow the active scan to one boundary or sub-tree.
  - Use --sql-root only when specs intentionally point into a shared SQL root instead of staying feature-local.
  - Use --exclude-generated to skip QuerySpec files under generated directories when those files are review-only noise.
  - Static column analysis is inherently uncertain and labels ambiguity via confidence/notes.
  - exprHints: best-effort only. Absence of exprHints does not imply the feature is not present.
  - statement_fingerprint is stable across formatting/comment changes under the current normalization contract.
`
  );

  // Keep outline/graph/slice/plan aligned with the existing query surface from main.
  // Issue #518 intentionally limits telemetry instrumentation in this file to query uses
  // so conflict resolution does not narrow the established query command surface.
  const uses = query.command('uses').description('Find where catalog SQL uses a table or column target');

  uses
    .command('table [target]')
    .description('Find statements that use a table target')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--view <view>', 'Investigation view (impact|detail)', 'impact')
    .addOption(new Option('--scope-dir <path>', QUERY_SCOPE_DIR_HELP))
    .option('--sql-root <path>', 'Optional fallback root for shared sqlFile layouts when specs are not feature-local')
    .option('--exclude-generated', 'Exclude QuerySpec files under generated directories from scan targets')
    .option('--out <path>', 'Write output to file')
    .option('--summary-only', 'Emit summary counts without per-match details')
    .option('--limit <count>', 'Limit returned matches and warnings in the output')
    .option('--json <payload>', 'Pass command options as a JSON object')
    .option('--any-schema', 'Allow <table> lookup across schemas')
    .option('--any-table', 'Unsupported for table usage')
    .action((target: string | undefined, options: QueryUsesOptions) => {
      runQueryUsesCommand('table', target, options);
    });

  uses
    .command('column [target]')
    .description('Find statements that use a column target')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--view <view>', 'Investigation view (impact|detail)', 'impact')
    .addOption(new Option('--scope-dir <path>', QUERY_SCOPE_DIR_HELP))
    .option('--sql-root <path>', 'Optional fallback root for shared sqlFile layouts when specs are not feature-local')
    .option('--exclude-generated', 'Exclude QuerySpec files under generated directories from scan targets')
    .option('--out <path>', 'Write output to file')
    .option('--summary-only', 'Emit summary counts without per-match details')
    .option('--limit <count>', 'Limit returned matches and warnings in the output')
    .option('--json <payload>', 'Pass command options as a JSON object')
    .option('--any-schema', 'Allow <table.column> or <column> lookup across schemas')
    .option('--any-table', 'Allow <column> lookup across tables (requires --any-schema)')
    .addHelpText(
      'after',
      `
Notes:
  - Impact is the default view. Use --view detail if you need edit-ready locations/snippets.
  - Impact representatives may omit select snippets; use --view detail for edit-ready SELECT occurrences.
  - Project-wide discovery is the default. Use --scope-dir only when you want to narrow the active scan.
  - Feature-local spec-relative sqlFile values are the preferred contract. Use --sql-root only for shared-root fallback.
  - exprHints: best-effort only. Absence of exprHints does not imply the feature is not present.
`
    )
    .action((target: string | undefined, options: QueryUsesOptions) => {
      runQueryUsesCommand('column', target, options);
    });

  query
    .command('outline <sqlFile>')
    .description('Summarize query structure, CTE dependencies, and base table usage')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QueryStructureOptions) => {
      runQueryStructureCommand(sqlFile, options, false, 'ztd query outline');
    });

  query
    .command('graph <sqlFile>')
    .description('Emit the query dependency graph in text, JSON, or DOT form')
    .option('--format <format>', 'Output format (text|json|dot)', 'text')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QueryStructureOptions) => {
      runQueryStructureCommand(sqlFile, options, true, 'ztd query graph');
    });

  query
    .command('slice <sqlFile>')
    .description('Generate a minimal executable SQL slice for a target CTE or the final query')
    .option('--cte <name>', 'Slice a specific CTE into a standalone debug query')
    .option('--final', 'Slice the final query while removing unused CTEs')
    .option('--limit <count>', 'Add LIMIT to the emitted debug query when supported')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QuerySliceOptions) => {
      runQuerySliceCommand(sqlFile, options);
    });

  query
    .command('plan <sqlFile>')
    .description('Emit deterministic execution steps from CTE metadata')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--material <names>', 'Comma-separated CTE names to materialize')
    .option('--scalar-filter-column <names>', 'Comma-separated column names to bind from WHERE scalar filters')
    .option('--json <payload>', 'Pass command options as a JSON object')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QueryPlanOptions) => {
      runQueryPlanCommand(sqlFile, options);
    });

  query
    .command('lint <sqlFile>')
    .description('Report structural maintainability and analysis-safety issues in a SQL query')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--rules <list>', 'Comma-separated lint rules to enable (for example: join-direction)')
    .option('--out <path>', 'Write output to file')
    .addHelpText(
      'after',
      `
Notes:
  - If your installed CLI does not list --rules in this help output, upgrade to a newer published ztd-cli release before trying join-direction examples from Further Reading.
  - Use --rules join-direction to enable the FK-aware JOIN direction readability check.
  - Suppress a specific query with "-- ztd-lint-disable join-direction" when the reverse path is intentional.
  - The rule is opt-in in v1 and currently focuses on top-level inner joins with explicit FK evidence.
`
    )
    .action((sqlFile: string, options: QueryLintOptions) => {
      runQueryLintCommand(sqlFile, options);
    });

  query
    .command('match-observed')
    .description('Rank candidate SQL assets for an observed SELECT statement')
    .option('--sql <sql>', 'Observed SQL text to rank')
    .option('--sql-file <path>', 'Read the observed SQL text from a file')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--out <path>', 'Write output to file')
    .action((options: QueryMatchObservedOptions) => {
      runQueryMatchObservedCommand(options);
    });

  const sssql = query.command('sssql').description('Generate and refresh SQL-first optional filter scaffolds');

  sssql
    .command('list <sqlFile>')
    .description('List supported SSSQL optional branches discovered in the query')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--json <payload>', 'Pass command options as a JSON object')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QuerySssqlListOptions) => {
      runQuerySssqlListCommand(sqlFile, options);
    });

  sssql
    .command('scaffold <sqlFile>')
    .description('Generate SSSQL optional filter scaffolds near the closest source query')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--json <payload>', 'Pass command options as a JSON object')
    .option('--filter <name>', 'Target column for scalar scaffold, or primary anchor column for EXISTS/NOT EXISTS')
    .option('--parameter <name>', 'Explicit parameter name for structured SSSQL scaffold')
    .option('--operator <operator>', 'Scalar operator (=, <>, !=, <, <=, >, >=, like, ilike)')
    .option('--kind <kind>', 'Structured branch kind (scalar|exists|not-exists)')
    .option('--query <sql>', 'Subquery SQL for EXISTS/NOT EXISTS scaffold')
    .option('--query-file <path>', 'Read subquery SQL for EXISTS/NOT EXISTS scaffold from a file')
    .option('--anchor-column <names>', 'Comma-separated anchor columns used by $c0, $c1 placeholders')
    .option('--preview', 'Emit a unified diff without writing files')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QuerySssqlScaffoldOptions) => {
      runQuerySssqlScaffoldCommand(sqlFile, options);
    });

  sssql
    .command('refresh <sqlFile>')
    .description('Refresh existing SSSQL optional filter scaffolds without changing predicate meaning')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--json <payload>', 'Pass command options as a JSON object')
    .option('--preview', 'Emit a unified diff without writing files')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QuerySssqlRefreshOptions) => {
      runQuerySssqlRefreshCommand(sqlFile, options);
    });

  sssql
    .command('remove <sqlFile>')
    .description('Remove one supported SSSQL optional filter branch safely')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--json <payload>', 'Pass command options as a JSON object')
    .option('--all', 'Remove all recognized SSSQL branches in the query')
    .option('--parameter <name>', 'Parameter name that identifies the target branch')
    .option('--kind <kind>', 'Optional branch kind filter (scalar|exists|not-exists|expression)')
    .option('--operator <operator>', 'Optional scalar operator filter when removing scalar branches')
    .option('--target <target>', 'Optional target column filter when removing scalar branches')
    .option('--preview', 'Emit a unified diff without writing files')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QuerySssqlRemoveOptions) => {
      runQuerySssqlRemoveCommand(sqlFile, options);
    });

  query
    .command('patch')
    .description('Apply AI-edited SQL fragments back onto the original query safely')
    .command('apply <sqlFile>')
    .description('Replace one CTE in the original SQL with the matching definition from an edited SQL file')
    .option('--cte <name>', 'Target CTE name to replace in the original query')
    .option('--from <path>', 'Edited SQL file that contains the replacement CTE definition')
    .option('--preview', 'Emit a unified diff without writing files')
    .option('--out <path>', 'Write the patched SQL to a new file instead of overwriting the original')
    .action((sqlFile: string, options: QueryPatchApplyOptions) => {
      runQueryPatchApplyCommand(sqlFile, options);
    });
}

function runQueryUsesCommand(kind: 'table' | 'column', target: string | undefined, options: QueryUsesOptions): void {
  const resolved = withSpanSync(QUERY_USES_COMMAND_SPANS.resolveOptions, () => {
    const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;

    if ('specsDir' in merged) {
      throw new Error('Use scopeDir / --scope-dir instead of the removed specsDir / --specs-dir option.');
    }

    const format = normalizeFormat(normalizeStringOption(merged.format) ?? getAgentOutputFormat());
    const view = normalizeView(normalizeStringOption(merged.view) ?? 'impact');
    const resolvedTarget = normalizeStringOption(merged.target) ?? target;
    if (!resolvedTarget) {
      throw new Error('A target must be provided either as a positional argument or via --json {"target": "..."}');
    }

    return {
      merged,
      format,
      view,
      resolvedTarget,
    };
  }, {
    kind,
    targetProvided: Boolean(target),
    jsonPayload: Boolean(options.json),
  });

  const scopeDir = normalizeStringOption(resolved.merged.scopeDir);

  const report = buildQueryUsageReport({
    kind,
    rawTarget: resolved.resolvedTarget,
    rootDir: process.env.ZTD_PROJECT_ROOT,
    specsDir: scopeDir,
    sqlRoot: normalizeStringOption(resolved.merged.sqlRoot),
    excludeGenerated: normalizeBooleanOption(resolved.merged.excludeGenerated),
    view: resolved.view,
    anySchema: normalizeBooleanOption(resolved.merged.anySchema),
    anyTable: normalizeBooleanOption(resolved.merged.anyTable)
  });

  withSpanSync(QUERY_USES_COMMAND_SPANS.renderOutput, () => {
    const limitedReport = applyQueryOutputControls(report, {
      summaryOnly: normalizeBooleanOption(resolved.merged.summaryOnly),
      limit: normalizeLimit(resolved.merged.limit)
    });
    const contents = formatQueryUsageReport(limitedReport, resolved.format);
    const outPath = normalizeStringOption(resolved.merged.out);
    if (outPath) {
      writeQueryUsageOutput(outPath, contents);
      return;
    }
    console.log(contents.trimEnd());
  }, {
    format: resolved.format,
    writesFile: Boolean(resolved.merged.out),
  });
}

function runQueryStructureCommand(
  sqlFile: string,
  options: QueryStructureOptions,
  allowDot: boolean,
  commandName: string
): void {
  const format = normalizeStructureFormat(options.format ?? 'text', allowDot);
  const report = buildQueryStructureReport(sqlFile, commandName);
  const contents = formatQueryStructureReport(report, format);
  if (options.out) {
    writeQueryUsageOutput(options.out, contents);
    return;
  }
  console.log(contents.trimEnd());
}

function runQuerySliceCommand(sqlFile: string, options: QuerySliceOptions): void {
  const report = buildQuerySliceReport(sqlFile, {
    cte: normalizeStringOption(options.cte),
    final: normalizeBooleanOption(options.final),
    limit: normalizeLimit(options.limit)
  });
  if (options.out) {
    writeQueryUsageOutput(options.out, report.sql);
    return;
  }
  console.log(report.sql.trimEnd());
}

function runQueryPlanCommand(sqlFile: string, options: QueryPlanOptions): void {
  const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
  const scalarFilterOption = merged.scalarFilterColumns ?? merged.scalarFilterColumn;
  if (scalarFilterOption === undefined && (merged as Record<string, unknown>).scalarMaterial !== undefined) {
    throw new Error('Use scalarFilterColumns / --scalar-filter-column instead of scalarMaterial / --scalar-material.');
  }

  const format = normalizePlanFormat(normalizeStringOption(merged.format) ?? getAgentOutputFormat());
  const plan = buildQueryPipelinePlan(sqlFile, {
    material: normalizeListOption(merged.material, '--material'),
    scalarFilterColumns: normalizeListOption(scalarFilterOption, '--scalar-filter-column')
  });
  const contents = formatQueryPipelinePlan(plan, format);
  const outPath = normalizeStringOption(merged.out);
  if (outPath) {
    writeQueryUsageOutput(outPath, contents);
    return;
  }
  console.log(contents.trimEnd());
}

function runQueryLintCommand(sqlFile: string, options: QueryLintOptions): void {
  const format = normalizeLintFormat(normalizeStringOption(options.format) ?? getAgentOutputFormat());
  const report = buildQueryLintReport(sqlFile, {
    projectRoot: process.env.ZTD_PROJECT_ROOT ?? process.cwd(),
    rules: normalizeRuleList(options.rules)
  });
  const contents = formatQueryLintReport(report, format);
  if (options.out) {
    writeQueryUsageOutput(options.out, contents);
    return;
  }
  console.log(contents.trimEnd());
}

function runQueryMatchObservedCommand(options: QueryMatchObservedOptions): void {
  const format = normalizeFormat(normalizeStringOption(options.format) ?? getAgentOutputFormat());
  const observedSql = resolveObservedSqlInput(options);
  const report = buildObservedSqlMatchReport({
    observedSql,
    rootDir: process.env.ZTD_PROJECT_ROOT ?? process.cwd()
  });
  const contents = formatObservedSqlMatchReport(report, format);

  if (options.out) {
    writeQueryUsageOutput(options.out, contents);
  } else if (format === 'json') {
    process.stdout.write(contents);
  } else {
    console.log(contents.trimEnd());
  }

  if (report.matches.length === 0) {
    console.error('No candidate SELECT assets were found for the observed SQL.');
    process.exitCode = 1;
  }
}

function normalizeRuleList(value: unknown): Array<'join-direction'> | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const rules = new Set<'join-direction'>();
  for (const rawValue of rawValues) {
    if (typeof rawValue !== 'string') {
      throw new Error(`Expected lint rules to be a string or string[] but received ${typeof rawValue}.`);
    }

    // Accept comma-separated CLI input and JSON arrays with one item per entry.
    for (const item of rawValue.split(',')) {
      const normalized = item.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      if (normalized !== 'join-direction') {
        throw new Error(`Unsupported lint rule: ${item}. Supported rules: join-direction`);
      }
      rules.add('join-direction');
    }
  }

  return rules.size > 0 ? [...rules] : undefined;
}

function runQueryPatchApplyCommand(sqlFile: string, options: QueryPatchApplyOptions): void {
  const cte = normalizeRequiredStringOption(options.cte, '--cte');
  const from = normalizeRequiredStringOption(options.from, '--from');
  const report = applyQueryPatch(sqlFile, {
    cte,
    from,
    out: normalizeStringOption(options.out),
    preview: normalizeBooleanOption(options.preview)
  });

  if (isJsonOutput()) {
    writeCommandEnvelope('query patch apply', {
      file: report.file,
      edited_file: report.edited_file,
      target_cte: report.target_cte,
      preview: report.preview,
      changed: report.changed,
      written: report.written,
      output_file: report.output_file,
      diff: report.diff,
      updated_sql: report.updated_sql
    });
    return;
  }

  if (report.preview) {
    process.stdout.write(report.diff);
    if (!report.diff.endsWith('\n')) {
      process.stdout.write('\n');
    }
    return;
  }

  process.stdout.write([
    `Patched CTE: ${report.target_cte}`,
    `Edited SQL: ${report.edited_file}`,
    `Output file: ${report.output_file}`,
    `Changed: ${report.changed ? 'yes' : 'no'}`
  ].join('\n'));
  process.stdout.write('\n');
}

function runQuerySssqlListCommand(sqlFile: string, options: QuerySssqlListOptions): void {
  const resolved = options.json
    ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') }
    : options;
  const sql = readFileSync(sqlFile, 'utf8');
  const branches = new SSSQLFilterBuilder().list(sql);
  const format = normalizeFormat(normalizeStringOption(resolved.format) ?? getAgentOutputFormat());
  const outputFile = normalizeStringOption(resolved.out);
  const contents = format === 'json'
    ? JSON.stringify({
      command: 'query sssql list',
      ok: true,
      data: {
        file: sqlFile,
        branch_count: branches.length,
        branches: branches.map((branch, index) => serializeSssqlBranch(branch, index))
      }
    })
    : formatSssqlBranchList(branches);

  if (outputFile) {
    writeQueryUsageOutput(outputFile, contents);
    if (format !== 'json') {
      return;
    }
  }

  if (format === 'json') {
    process.stdout.write(outputFile ? `${contents}\n` : contents);
    return;
  }

  process.stdout.write(contents.endsWith('\n') ? contents : `${contents}\n`);
}

function runQuerySssqlScaffoldCommand(sqlFile: string, options: QuerySssqlScaffoldOptions): void {
  const resolved = options.json
    ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') }
    : options;
  const filters = normalizeSssqlFilters(resolved.filters ?? (isLegacyFilterObject(resolved.filter) ? resolved.filter : undefined));
  const spec = buildStructuredSssqlScaffoldSpec(resolved);
  const report = applySssqlRewrite(sqlFile, {
    commandName: 'query sssql scaffold',
    out: normalizeStringOption(resolved.out),
    preview: normalizeBooleanOption(resolved.preview),
    transform: (sql) => {
      const builder = new SSSQLFilterBuilder();
      if (spec) {
        return builder.scaffoldBranch(sql, spec);
      }
      return builder.scaffold(sql, filters);
    }
  });

  emitSssqlRewriteReport(report, normalizeFormat(normalizeStringOption(resolved.format) ?? getAgentOutputFormat()));
}

function runQuerySssqlRefreshCommand(sqlFile: string, options: QuerySssqlRefreshOptions): void {
  const resolved = options.json
    ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') }
    : options;
  const report = applySssqlRewrite(sqlFile, {
    commandName: 'query sssql refresh',
    out: normalizeStringOption(resolved.out),
    preview: normalizeBooleanOption(resolved.preview),
    transform: (sql) => {
      const parsed = SelectQueryParser.parse(sql);
      const existingBranches = collectSupportedOptionalConditionBranches(parsed);
      const filters = Object.fromEntries(existingBranches.map((branch) => [branch.parameterName, null]));
      return new SSSQLFilterBuilder().refresh(parsed, filters);
    }
  });

  emitSssqlRewriteReport(report, normalizeFormat(normalizeStringOption(resolved.format) ?? getAgentOutputFormat()));
}

function runQuerySssqlRemoveCommand(sqlFile: string, options: QuerySssqlRemoveOptions): void {
  const resolved = options.json
    ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') }
    : options;
  const report = applySssqlRewrite(sqlFile, {
    commandName: 'query sssql remove',
    out: normalizeStringOption(resolved.out),
    preview: normalizeBooleanOption(resolved.preview),
    transform: (sql) => {
      const builder = new SSSQLFilterBuilder();
      if (normalizeBooleanOption(resolved.all)) {
        assertNoTargetedRemoveOptions(resolved);
        return builder.removeAll(sql);
      }

      const spec = normalizeSssqlRemoveSpec(resolved);
      return builder.remove(sql, spec);
    }
  });

  emitSssqlRewriteReport(report, normalizeFormat(normalizeStringOption(resolved.format) ?? getAgentOutputFormat()));
}

function normalizeLimit(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`Unsupported limit type: ${typeof value}. Use a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Unsupported limit: ${value}. Use a positive integer.`);
  }
  return parsed;
}

function normalizeStringOption(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Expected a string option but received ${typeof value}.`);
  }
  return value;
}

function normalizeRequiredStringOption(value: unknown, label: string): string {
  const normalized = normalizeStringOption(value);
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeBooleanOption(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`Expected a boolean option but received ${typeof value}.`);
  }
  return value;
}

function normalizeListOption(value: unknown, label: string): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const normalized: string[] = [];

  for (const rawValue of rawValues) {
    if (typeof rawValue !== 'string') {
      throw new Error(`Expected ${label} to be a string or string[] but received ${typeof rawValue}.`);
    }

    // Accept comma-separated CLI input and JSON arrays with one item per entry.
    for (const item of rawValue.split(',')) {
      const trimmed = item.trim();
      if (trimmed.length > 0) {
        normalized.push(trimmed);
      }
    }
  }

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSssqlFilters(value: unknown): SssqlScaffoldFilters {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected SSSQL filters to be a JSON object but received ${typeof value}.`);
  }

  const filters = value as Record<string, unknown>;
  const normalized: SssqlScaffoldFilters = {};

  for (const [key, rawValue] of Object.entries(filters)) {
    normalized[key] = rawValue as SssqlScaffoldFilters[string];
  }

  return normalized;
}

function isLegacyFilterObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildStructuredSssqlScaffoldSpec(value: QuerySssqlScaffoldOptions): SssqlScaffoldSpec | undefined {
  const explicitFilter = normalizeStringOption(value.filter);
  const explicitKind = normalizeStringOption(value.kind)?.trim().toLowerCase();
  const explicitQuery = normalizeStringOption(value.query);
  const explicitQueryFile = normalizeStringOption(value.queryFile);
  const operator = normalizeStringOption(value.operator);
  const parameter = normalizeStringOption(value.parameter);
  const anchorColumns = normalizeListOption(value.anchorColumns ?? value.anchorColumn, '--anchor-column');

  const hasStructuredInputs = Boolean(explicitFilter || explicitKind || explicitQuery || explicitQueryFile || operator || parameter || anchorColumns?.length);
  if (!hasStructuredInputs) {
    return undefined;
  }

  const target = explicitFilter;
  const query = resolveSssqlSubqueryInput(explicitQuery, explicitQueryFile);

  if (explicitKind === 'exists' || explicitKind === 'not-exists' || query) {
    return {
      kind: normalizeSssqlExistsKind(explicitKind),
      parameterName: normalizeRequiredStringOption(parameter, '--parameter'),
      query: normalizeRequiredStringOption(query, '--query or --query-file'),
      anchorColumns: anchorColumns ?? [normalizeRequiredStringOption(target, '--filter')]
    };
  }

  return {
    target: normalizeRequiredStringOption(target, '--filter'),
    parameterName: parameter,
    operator: operator as SssqlScaffoldSpec extends infer _ ? string : never
  } as SssqlScaffoldSpec;
}

function normalizeSssqlExistsKind(value: string | undefined): 'exists' | 'not-exists' {
  if (!value || value === 'exists') {
    return 'exists';
  }
  if (value === 'not-exists') {
    return 'not-exists';
  }
  throw new Error(`Unsupported SSSQL branch kind: ${value}. Use exists or not-exists.`);
}

function normalizeSssqlRemoveSpec(value: QuerySssqlRemoveOptions): SssqlRemoveSpec {
  const kindValue = normalizeStringOption(value.kind)?.trim().toLowerCase();
  return {
    parameterName: normalizeRequiredStringOption(value.parameter, '--parameter'),
    kind: kindValue ? normalizeSssqlBranchKind(kindValue) : undefined,
    operator: normalizeStringOption(value.operator) as SssqlRemoveSpec['operator'],
    target: normalizeStringOption(value.target)
  };
}

function assertNoTargetedRemoveOptions(value: QuerySssqlRemoveOptions): void {
  if (
    normalizeStringOption(value.parameter) ||
    normalizeStringOption(value.kind) ||
    normalizeStringOption(value.operator) ||
    normalizeStringOption(value.target)
  ) {
    throw new Error('Use --all by itself. Do not combine it with --parameter, --kind, --operator, or --target.');
  }
}

function normalizeSssqlBranchKind(value: string): SssqlBranchKind {
  if (value === 'scalar' || value === 'exists' || value === 'not-exists' || value === 'expression') {
    return value;
  }
  throw new Error(`Unsupported SSSQL branch kind: ${value}.`);
}

function resolveSssqlSubqueryInput(sqlText: string | undefined, sqlFile: string | undefined): string | undefined {
  if (sqlText && sqlFile) {
    throw new Error('Use either --query or --query-file, not both.');
  }

  if (sqlText) {
    return sqlText;
  }

  if (sqlFile) {
    return readFileSync(sqlFile, 'utf8');
  }

  return undefined;
}

function serializeSssqlBranch(branch: SssqlBranchInfo, index: number): Record<string, unknown> {
  return {
    index: index + 1,
    parameterName: branch.parameterName,
    kind: branch.kind,
    operator: branch.operator ?? null,
    target: branch.target ?? null,
    sql: branch.sql
  };
}

function formatSssqlBranchList(branches: SssqlBranchInfo[]): string {
  if (branches.length === 0) {
    return 'No supported SSSQL branches found.\n';
  }

  const lines: string[] = [];
  branches.forEach((branch, index) => {
    lines.push(`${index + 1}. parameter: ${branch.parameterName}`);
    lines.push(`   kind: ${branch.kind}`);
    if (branch.operator) {
      lines.push(`   operator: ${branch.operator}`);
    }
    if (branch.target) {
      lines.push(`   target: ${branch.target}`);
    }
    lines.push(`   sql: ${branch.sql}`);
  });

  return `${lines.join('\n')}\n`;
}

interface SssqlRewriteReport {
  commandName: string;
  file: string;
  output_file: string | null;
  preview: boolean;
  changed: boolean;
  written: boolean;
  sql: string;
  diff: string;
}

function applySssqlRewrite(
  sqlFile: string,
  options: {
    commandName: string;
    out?: string;
    preview?: boolean;
    transform: (sql: string) => unknown;
  }
): SssqlRewriteReport {
  const absoluteInputPath = path.resolve(sqlFile);
  const originalSql = readFileSync(absoluteInputPath, 'utf8');
  const transformed = options.transform(originalSql);
  const formatted = new SqlFormatter().format(transformed as never).formattedSql;
  const updatedSql = `${formatted}\n`;
  assertNoCommentLoss(originalSql, updatedSql, options.commandName);

  SelectQueryParser.parse(updatedSql);

  const preview = Boolean(options.preview);
  const outputFile = path.resolve(options.out ?? absoluteInputPath);
  const changed = normalizeLineEndings(originalSql) !== normalizeLineEndings(updatedSql);
  const diff = createTwoFilesPatch(
    normalizePath(absoluteInputPath),
    normalizePath(outputFile),
    normalizeLineEndings(originalSql),
    normalizeLineEndings(updatedSql),
    '',
    '',
    { context: 3 }
  );

  if (!preview) {
    writeFileSync(outputFile, updatedSql, 'utf8');
  }

  return {
    commandName: options.commandName,
    file: absoluteInputPath,
    output_file: outputFile,
    preview,
    changed,
    written: !preview,
    sql: formatted,
    diff
  };
}

function emitSssqlRewriteReport(report: SssqlRewriteReport, format: 'text' | 'json'): void {
  if (format === 'json') {
    writeCommandEnvelope(report.commandName, {
      file: report.file,
      output_file: report.output_file,
      preview: report.preview,
      changed: report.changed,
      written: report.written,
      sql: report.sql,
      diff: report.diff
    });
    return;
  }

  if (report.preview) {
    process.stdout.write(report.diff.endsWith('\n') ? report.diff : `${report.diff}\n`);
    return;
  }

  return;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

function assertNoCommentLoss(before: string, after: string, commandName: string): void {
  const beforeComments = extractSqlCommentFragments(before);
  if (beforeComments.length === 0) {
    return;
  }

  const normalizedAfter = normalizeLineEndings(after);
  const missing = beforeComments.filter(comment => !normalizedAfter.includes(comment));
  if (missing.length > 0) {
    throw new Error(`${commandName} would drop SQL comments during rewrite. Remove or relocate the comments before applying this command.`);
  }
}

function extractSqlCommentFragments(sql: string): string[] {
  const normalized = normalizeLineEndings(sql);
  const matches = normalized.match(/--.*$/gm) ?? [];
  const blockMatches = normalized.match(/\/\*[\s\S]*?\*\//g) ?? [];
  return [...matches, ...blockMatches].map(comment => comment.trim()).filter(Boolean);
}

function resolveObservedSqlInput(options: QueryMatchObservedOptions): string {
  const sqlText = normalizeStringOption(options.sql);
  const sqlFile = normalizeStringOption(options.sqlFile);

  if (sqlText && sqlFile) {
    throw new Error('Use either --sql or --sql-file, not both.');
  }

  if (sqlText) {
    return sqlText;
  }

  if (sqlFile) {
    return readFileSync(sqlFile, 'utf8');
  }

  throw new Error('Provide observed SQL with --sql or --sql-file.');
}

function normalizeFormat(format: string): 'text' | 'json' {
  const normalized = format.trim().toLowerCase();
  if (normalized === 'text' || normalized === 'json') {
    return normalized;
  }
  throw new Error(`Unsupported format: ${format}`);
}

function normalizePlanFormat(format: string): QueryPipelinePlanFormat {
  return normalizeFormat(format);
}

function normalizeLintFormat(format: string): QueryLintFormat {
  return normalizeFormat(format);
}

function normalizeStructureFormat(format: string, allowDot: boolean): QueryStructureFormat {
  const normalized = format.trim().toLowerCase();
  if (normalized === 'text' || normalized === 'json') {
    return normalized;
  }
  if (allowDot && normalized === 'dot') {
    return normalized;
  }
  throw new Error(`Unsupported format: ${format}`);
}

function normalizeView(view: string): 'impact' | 'detail' {
  const normalized = view.trim().toLowerCase();
  if (normalized === 'impact' || normalized === 'detail') {
    return normalized;
  }
  throw new Error(`Unsupported view: ${view}`);
}

