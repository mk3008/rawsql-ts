import { Command } from 'commander';
import { formatQueryUsageReport } from '../query/format';
import { buildQueryUsageReport, writeQueryUsageOutput } from '../query/report';
import {
  buildQueryStructureReport,
  formatQueryStructureReport,
  type QueryStructureFormat
} from '../query/structure';

interface QueryUsesOptions {
  format?: string;
  specsDir?: string;
  sqlRoot?: string;
  excludeGenerated?: boolean;
  out?: string;
  view?: string;
  anySchema?: boolean;
  anyTable?: boolean;
}

interface QueryStructureOptions {
  format?: string;
  out?: string;
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
  $ ztd query outline large_query.sql
  $ ztd query graph large_query.sql --format dot

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
    .command('table <target>')
    .description('Find statements that use a table target')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--view <view>', 'Investigation view (impact|detail)', 'impact')
    .option('--specs-dir <path>', 'Override SQL catalog specs directory (default: src/catalog/specs)')
    .option('--sql-root <path>', 'Resolve sqlFile paths relative to the project SQL root first (default: src/sql)')
    .option('--exclude-generated', 'Exclude specs under src/catalog/specs/generated from scan targets')
    .option('--out <path>', 'Write output to file')
    .option('--any-schema', 'Allow <table> lookup across schemas')
    .option('--any-table', 'Unsupported for table usage')
    .action((target: string, options: QueryUsesOptions) => {
      runQueryUsesCommand('table', target, options);
    });

  uses
    .command('column <target>')
    .description('Find statements that use a column target')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--view <view>', 'Investigation view (impact|detail)', 'impact')
    .option('--specs-dir <path>', 'Override SQL catalog specs directory (default: src/catalog/specs)')
    .option('--sql-root <path>', 'Resolve sqlFile paths relative to the project SQL root first (default: src/sql)')
    .option('--exclude-generated', 'Exclude specs under src/catalog/specs/generated from scan targets')
    .option('--out <path>', 'Write output to file')
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
    .action((target: string, options: QueryUsesOptions) => {
      runQueryUsesCommand('column', target, options);
    });

  query
    .command('outline <sqlFile>')
    .description('Summarize query structure, CTE dependencies, and base table usage')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QueryStructureOptions) => {
      runQueryStructureCommand(sqlFile, options, false);
    });

  query
    .command('graph <sqlFile>')
    .description('Emit the query dependency graph in JSON or DOT form')
    .option('--format <format>', 'Output format (json|dot|text)', 'json')
    .option('--out <path>', 'Write output to file')
    .action((sqlFile: string, options: QueryStructureOptions) => {
      runQueryStructureCommand(sqlFile, options, true);
    });
}

function runQueryUsesCommand(kind: 'table' | 'column', target: string, options: QueryUsesOptions): void {
  const format = normalizeFormat(options.format ?? 'text');
  const view = normalizeView(options.view ?? 'impact');
  const report = buildQueryUsageReport({
    kind,
    rawTarget: target,
    rootDir: process.env.ZTD_PROJECT_ROOT,
    specsDir: options.specsDir,
    sqlRoot: options.sqlRoot,
    excludeGenerated: Boolean(options.excludeGenerated),
    view,
    anySchema: Boolean(options.anySchema),
    anyTable: Boolean(options.anyTable)
  });
  const contents = formatQueryUsageReport(report, format);
  if (options.out) {
    writeQueryUsageOutput(options.out, contents);
    return;
  }
  console.log(contents.trimEnd());
}

function runQueryStructureCommand(sqlFile: string, options: QueryStructureOptions, allowDot: boolean): void {
  const format = normalizeStructureFormat(options.format ?? (allowDot ? 'json' : 'text'), allowDot);
  const report = buildQueryStructureReport(sqlFile);
  const contents = formatQueryStructureReport(report, format);
  if (options.out) {
    writeQueryUsageOutput(options.out, contents);
    return;
  }
  console.log(contents.trimEnd());
}

function normalizeFormat(format: string): 'text' | 'json' {
  const normalized = format.trim().toLowerCase();
  if (normalized === 'text' || normalized === 'json') {
    return normalized;
  }
  throw new Error(`Unsupported format: ${format}`);
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
