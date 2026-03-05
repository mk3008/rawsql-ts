import { Command } from 'commander';
import { applyQueryOutputControls, formatQueryUsageReport } from '../query/format';
import { buildQueryUsageReport, writeQueryUsageOutput } from '../query/report';
import { getAgentOutputFormat, parseJsonPayload } from '../utils/agentCli';

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
}

function runQueryUsesCommand(kind: 'table' | 'column', target: string | undefined, options: QueryUsesOptions): void {
  const merged = options.json ? { ...options, ...parseJsonPayload<Record<string, unknown>>(options.json, '--json') } : options;
  const format = normalizeFormat(normalizeStringOption(merged.format) ?? getAgentOutputFormat());
  const view = normalizeView(normalizeStringOption(merged.view) ?? 'impact');
  const resolvedTarget = normalizeStringOption(merged.target) ?? target;
  if (!resolvedTarget) {
    throw new Error('A target must be provided either as a positional argument or via --json {"target": "..."}');
  }
  const report = buildQueryUsageReport({
    kind,
    rawTarget: resolvedTarget,
    rootDir: process.env.ZTD_PROJECT_ROOT,
    specsDir: normalizeStringOption(merged.specsDir),
    sqlRoot: normalizeStringOption(merged.sqlRoot),
    excludeGenerated: normalizeBooleanOption(merged.excludeGenerated),
    view,
    anySchema: normalizeBooleanOption(merged.anySchema),
    anyTable: normalizeBooleanOption(merged.anyTable)
  });
  const limitedReport = applyQueryOutputControls(report, {
    summaryOnly: normalizeBooleanOption(merged.summaryOnly),
    limit: normalizeLimit(merged.limit)
  });
  const contents = formatQueryUsageReport(limitedReport, format);
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

function normalizeFormat(format: string): 'text' | 'json' {
  const normalized = format.trim().toLowerCase();
  if (normalized === 'text' || normalized === 'json') {
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
