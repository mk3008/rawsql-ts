import { Command } from 'commander';
import { applyQueryOutputControls, formatQueryUsageReport } from '../query/format';
import {
  buildQueryPipelinePlan,
  formatQueryPipelinePlan,
  type QueryPipelinePlanFormat
} from '../query/planner';
import { buildQueryUsageReport, writeQueryUsageOutput } from '../query/report';
import { buildQuerySliceReport } from '../query/slice';
import {
  buildQueryStructureReport,
  formatQueryStructureReport,
  type QueryStructureFormat
} from '../query/structure';
import { getAgentOutputFormat, parseJsonPayload } from '../utils/agentCli';
import { withSpanSync } from '../utils/telemetry';

interface QueryUsesOptions {
  format?: string;
  specsDir?: string;
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
  scalarMaterial?: unknown;
  json?: string;
}

interface QuerySliceOptions {
  cte?: string;
  final?: boolean;
  out?: string;
  limit?: string;
}

export const QUERY_USES_COMMAND_SPANS = {
  resolveOptions: 'resolve-query-options',
  renderOutput: 'render-query-usage-output',
} as const;

/**
 * Register strict-first impact investigation commands on the CLI root.
 */
export function registerQueryCommands(program: Command): void {
  const query = program.command('query').description('Impact investigation for SQL catalog assets');
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
  $ ztd query plan large_query.sql --material base_cte --scalar-material total_cte --format json

Notes:
  - Strict mode is the default. Relaxed modes are explicit opt-in only.
  - Impact is the default view. Use --view detail for edit-ready locations/snippets.
  - Impact representatives may omit select snippets; use --view detail for edit-ready SELECT occurrences.
  - Use --exclude-generated to skip specs under src/catalog/specs/generated when those files are review-only noise.
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
    .option('--specs-dir <path>', 'Override SQL catalog specs directory (default: src/catalog/specs)')
    .option('--sql-root <path>', 'Resolve sqlFile paths relative to the project SQL root first (default: src/sql)')
    .option('--exclude-generated', 'Exclude specs under src/catalog/specs/generated from scan targets')
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
    .option('--specs-dir <path>', 'Override SQL catalog specs directory (default: src/catalog/specs)')
    .option('--sql-root <path>', 'Resolve sqlFile paths relative to the project SQL root first (default: src/sql)')
    .option('--exclude-generated', 'Exclude specs under src/catalog/specs/generated from scan targets')
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
    .option('--scalar-material <names>', 'Comma-separated CTE names to scalar materialize')
    .option('--json <payload>', 'Pass command options as a JSON object')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QueryPlanOptions) => {
      runQueryPlanCommand(sqlFile, options);
    });
}

function runQueryUsesCommand(kind: 'table' | 'column', target: string | undefined, options: QueryUsesOptions): void {
  const resolved = withSpanSync(QUERY_USES_COMMAND_SPANS.resolveOptions, () => {
    const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
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

  const report = buildQueryUsageReport({
    kind,
    rawTarget: resolved.resolvedTarget,
    rootDir: process.env.ZTD_PROJECT_ROOT,
    specsDir: normalizeStringOption(resolved.merged.specsDir),
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
  const format = normalizePlanFormat(normalizeStringOption(merged.format) ?? getAgentOutputFormat());
  const plan = buildQueryPipelinePlan(sqlFile, {
    material: normalizeListOption(merged.material, '--material'),
    scalarMaterial: normalizeListOption(merged.scalarMaterial, '--scalar-material')
  });
  const contents = formatQueryPipelinePlan(plan, format);
  const outPath = normalizeStringOption(merged.out);
  if (outPath) {
    writeQueryUsageOutput(outPath, contents);
    return;
  }
  console.log(contents.trimEnd());
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