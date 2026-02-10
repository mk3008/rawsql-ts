import path from 'node:path';
import os from 'node:os';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { ensureDirectory, readUtf8File, writeUtf8File } from './lib/fs';
import type { EvalReport } from './lib/report';

type ProposalKind = 'template_text' | 'template_skeleton' | 'library_change';
type ProposalRisk = 'low' | 'medium' | 'high';

interface LoopOptions {
  loopCount: number;
  scenario: string;
  keepWorkspace: boolean;
  reportPrefix: string;
}

interface ProposalEvidence {
  report: string;
  source: string;
  excerpt: string;
}

interface Proposal {
  kind: ProposalKind;
  title: string;
  rationale: string;
  evidence: ProposalEvidence[];
  patch_targets: string[];
  expected_effect: string[];
  risk: ProposalRisk;
}

interface FailureCluster {
  category: string;
  count: number;
  examples: string[];
  evidence: ProposalEvidence[];
}

interface LoopSummary {
  generated_at: string;
  loop_count: number;
  scenario: string;
  reports: string[];
  iterations: Array<{
    index: number;
    report_path: string;
    success: boolean;
    score_total: number;
    failed_categories: string[];
    duration_ms: number;
    runner_exit_code: number | null;
    runner_elapsed_ms: number;
    runner_report_written: boolean;
    runner_log_path?: string;
    runner_last_event: string;
    runner_report_expected_path: string;
    runner_report_exists: boolean;
    runner_exit_code_mismatch: boolean;
    runner_wall_timeout: boolean;
    runner_wall_timeout_ms: number;
    runner_wall_timeout_note?: string;
    runner_report_missing?: {
      exit_code: number | null;
      output_head: string;
      stdout_head: string;
      stderr_head: string;
      next_command: string;
    };
  }>;
  aggregate: {
    pass_rate: number;
    average_score: number;
    min_score: number;
    max_score: number;
    runner_report_missing_count: number;
    runner_exit_code_counts: Record<string, number>;
    loop_exit_code: number;
    loop_completed: boolean;
    exit_code_note: string;
    preflight_write_present_count: number;
    preflight_write_executed_count: number;
    preflight_write_skipped_count: number;
    dirty_worktree_present_count: number;
    dirty_worktree_failed_count: number;
    runner_exit_code_mismatch_count: number;
    failure_clusters: FailureCluster[];
    failure_cluster_entropy: number;
    loop_latency_ms: {
      per_run: number[];
      median: number;
      p95: number;
    };
  };
  proposals: Proposal[];
  applied_proposal: {
    applied: boolean;
    title?: string;
    kind?: ProposalKind;
    patch_targets?: string[];
    notes: string;
  };
  stop_conditions: {
    primary_met: boolean;
    secondary_met: boolean;
  };
}

type EvalCheck = EvalReport['checks'][number];

interface PreflightWriteStats {
  presentCount: number;
  executedCount: number;
  skippedCount: number;
}

interface DirtyWorktreeStats {
  presentCount: number;
  failedCount: number;
}

interface RunnerMissingMeta {
  exitCode: number | null;
  outputHead: string;
  stdoutHead: string;
  stderrHead: string;
  nextCommand: string;
}

interface IterationRuntimeMeta {
  runnerExitCode: number | null;
  runnerElapsedMs: number;
  runnerReportWritten: boolean;
  runnerLogPath?: string;
  runnerLastEvent: string;
  runnerReportExpectedPath: string;
  runnerReportExists: boolean;
  runnerExitCodeMismatch: boolean;
  runnerWallTimeout: boolean;
  runnerWallTimeoutMs: number;
  runnerWallTimeoutNote?: string;
}

interface RunnerCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  log: {
    outputHead: string;
  };
  wallTimedOut: boolean;
  wallTimeoutMs: number;
}

function sanitizeLogValue(value: unknown): string {
  return String(value).replace(/\s+/g, ' ').trim();
}

function parseRunnerWallTimeoutMs(raw: string | undefined): number {
  const fallbackMs = 15 * 60 * 1000;
  if (!raw) {
    return fallbackMs;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return Math.floor(parsed);
}

function sanitizeRunnerLogToken(input: string): string {
  const normalized = input.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
  return normalized.length > 0 ? normalized : 'loop';
}

function buildDefaultRunnerLogPath(
  repoRoot: string,
  reportPrefix: string,
  timestamp: string,
  iteration: number
): string {
  const prefixToken = sanitizeRunnerLogToken(reportPrefix);
  const iterToken = String(iteration).padStart(2, '0');
  return path.resolve(repoRoot, 'eval', 'tmp', `runner-${prefixToken}-${timestamp}-${iterToken}.log`);
}

async function readRunnerLastEvent(logPath: string | undefined): Promise<string> {
  if (!logPath || !existsSync(logPath)) {
    return '';
  }
  try {
    const raw = await readUtf8File(logPath);
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('[eval-runner]'));
    return lines[lines.length - 1] ?? '';
  } catch {
    return '';
  }
}

function detectRunnerExitCodeMismatch(runnerExitCode: number | null, runnerLastEvent: string): boolean {
  if (runnerExitCode !== 124 || runnerLastEvent.length === 0) {
    return false;
  }
  const match = runnerLastEvent.match(/exit_code=(\d+)/);
  if (!match) {
    return false;
  }
  return match[1] !== '124';
}

function buildOutputHead(stdout: string, stderr: string): string {
  const merged = [stdout.trim(), stderr.trim()].filter((part) => part.length > 0).join('\n');
  if (merged.length === 0) {
    return '';
  }
  return merged.split(/\r?\n/).slice(0, 30).join('\n');
}

async function runRunnerCommandWithWallTimeout(options: {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  wallTimeoutMs: number;
}): Promise<RunnerCommandResult> {
  return new Promise<RunnerCommandResult>((resolve) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      shell: false
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;
    let wallTimedOut = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finish = (exitCode: number | null) => {
      if (resolved) {
        return;
      }
      resolved = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      resolve({
        exitCode,
        stdout,
        stderr,
        log: {
          outputHead: buildOutputHead(stdout, stderr)
        },
        wallTimedOut,
        wallTimeoutMs: options.wallTimeoutMs
      });
    };

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error: Error) => {
      stderr += `${error.message}\n`;
    });

    child.on('close', (exitCode: number | null) => {
      finish(exitCode);
    });

    timeoutHandle = setTimeout(() => {
      if (resolved) {
        return;
      }
      wallTimedOut = true;
      stderr += `runner_wall_timeout: exceeded ${options.wallTimeoutMs}ms without run_command_end\n`;
      child.kill('SIGKILL');
      finish(124);
    }, options.wallTimeoutMs);
  });
}

function emitLoopEvent(event: string, fields: Record<string, unknown>): void {
  const parts = [`[eval-loop] event=${sanitizeLogValue(event)}`];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }
    parts.push(`${key}=${sanitizeLogValue(value)}`);
  }
  console.log(parts.join(' '));
}

function toWindowsCommand(args: string[]): { command: string; args: string[] } {
  const appData = process.env.APPDATA ?? '';
  const pnpmCmd = appData ? path.join(appData, 'npm', 'pnpm.cmd') : 'pnpm.cmd';
  const quoted = [pnpmCmd, ...args].map((item) => (/[ \t"]/g.test(item) ? `"${item.replace(/"/g, '\\"')}"` : item));
  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', quoted.join(' ')]
  };
}

function parseArgs(argv: string[]): LoopOptions {
  const envLoopRaw = process.env.EVAL_LOOP_MAX;
  const envLoop = Number(envLoopRaw);
  const hasValidEnvLoop = Number.isFinite(envLoop) && envLoop > 0;
  let loopCount = hasValidEnvLoop ? Math.floor(envLoop) : 3;
  let scenario = 'crud-basic';
  let keepWorkspace = false;
  let reportPrefix = 'eval/reports/loop';

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--loop') {
      const cliLoopRaw = Number(argv[i + 1] ?? String(loopCount));
      if (Number.isFinite(cliLoopRaw) && cliLoopRaw > 0) {
        loopCount = Math.floor(cliLoopRaw);
      }
      i += 1;
      continue;
    }
    if (token === '--scenario') {
      scenario = argv[i + 1] ?? 'crud-basic';
      i += 1;
      continue;
    }
    if (token === '--keep-workspace') {
      keepWorkspace = true;
      continue;
    }
    if (token === '--report-prefix') {
      reportPrefix = argv[i + 1] ?? reportPrefix;
      i += 1;
      continue;
    }
  }

  return { loopCount, scenario, keepWorkspace, reportPrefix };
}

function basename(filePath: string): string {
  return path.basename(filePath);
}

function computeDurationMs(report: EvalReport): number {
  const start = new Date(report.started_at).getTime();
  const end = new Date(report.finished_at).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }
  return end - start;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function buildMissingEvalReport(
  scenario: string,
  reportPath: string,
  runnerExitCode: number | null
): EvalReport {
  const now = new Date().toISOString();
  return {
    caseSlug: scenario,
    workspace_path: 'Not observed',
    cwd_used: 'Not observed',
    codex_home: 'Not observed',
    sandbox_mode: 'Not observed',
    started_at: now,
    finished_at: now,
    commands: [],
    checks: [],
    score_breakdown: {
      install: 0,
      typecheck: 0,
      test: 0,
      checks: 0,
      total: 0
    },
    score_total: 0,
    success: false,
    error: `runner_report_missing: report file was not generated (${path.basename(reportPath)}; runner_exit=${runnerExitCode ?? 'null'})`
  };
}

function addEvidence(
  buckets: Map<string, { count: number; examples: string[]; evidence: ProposalEvidence[] }>,
  category: string,
  evidence: ProposalEvidence
): void {
  const current = buckets.get(category) ?? { count: 0, examples: [], evidence: [] };
  current.count += 1;
  if (current.examples.length < 3) {
    current.examples.push(evidence.excerpt);
  }
  if (current.evidence.length < 8) {
    current.evidence.push(evidence);
  }
  buckets.set(category, current);
}

function readSkippedFlag(check: EvalCheck): boolean {
  if (!check.meta || typeof check.meta !== 'object') {
    return false;
  }
  return (check.meta as Record<string, unknown>).skipped === true;
}

function isNeutralPreflightWriteCheck(check: EvalCheck): boolean {
  return check.name === 'preflight_write' && readSkippedFlag(check);
}

function isFailureRelevantCheck(check: EvalCheck): boolean {
  if (isNeutralPreflightWriteCheck(check)) {
    return false;
  }
  return !check.passed;
}

function isNeutralPreflightWriteCommand(command: { outputHead: string }): boolean {
  return command.outputHead.includes('Skipped preflight_write');
}

function computePreflightWriteStats(reports: EvalReport[]): PreflightWriteStats {
  let presentCount = 0;
  let executedCount = 0;
  let skippedCount = 0;

  for (const report of reports) {
    const preflight = report.checks.find((check) => check.name === 'preflight_write');
    if (!preflight) {
      continue;
    }
    presentCount += 1;
    if (readSkippedFlag(preflight)) {
      skippedCount += 1;
    } else {
      executedCount += 1;
    }
  }

  return { presentCount, executedCount, skippedCount };
}

function computeDirtyWorktreeStats(reports: EvalReport[]): DirtyWorktreeStats {
  let presentCount = 0;
  let failedCount = 0;

  for (const report of reports) {
    const dirtyWorktree = report.checks.find((check) => check.name === 'dirty_worktree');
    if (!dirtyWorktree) {
      continue;
    }
    presentCount += 1;
    if (!dirtyWorktree.passed) {
      failedCount += 1;
    }
  }

  return { presentCount, failedCount };
}

function buildFailureClusters(reports: EvalReport[], reportPaths: string[]): FailureCluster[] {
  const buckets = new Map<string, { count: number; examples: string[]; evidence: ProposalEvidence[] }>();

  for (let index = 0; index < reports.length; index += 1) {
    const report = reports[index];
    const reportName = basename(reportPaths[index] ?? `report-${index + 1}.json`);

    if (report.error) {
      const category = report.error.includes(';') ? report.error.split(';')[0].trim() : report.error;
      addEvidence(buckets, category, {
        report: reportName,
        source: 'report.error',
        excerpt: report.error
      });
    }

    report.checks
      // Keep skipped preflight_write neutral in failure aggregation.
      .filter((check) => isFailureRelevantCheck(check))
      .forEach((check) => {
        addEvidence(buckets, check.name, {
          report: reportName,
          source: `checks.${check.name}.details[0]`,
          excerpt: check.details[0] ?? 'No detail'
        });
      });

    report.commands
      .map((command, commandIndex) => ({ command, commandIndex }))
      // Keep synthetic skipped preflight logs neutral if emitted with any future non-zero code.
      .filter(({ command }) => command.exitCode !== 0 && !isNeutralPreflightWriteCommand(command))
      .forEach(({ command, commandIndex }) => {
        const lower = `${command.command} ${command.args.join(' ')}`.toLowerCase();
        let category = 'command_failure';
        if (lower.includes('typecheck')) {
          category = 'typecheck failed (exit=2)';
        } else if (lower.includes(' test')) {
          category = 'test failed';
        } else if (lower.includes(' install')) {
          category = 'install failed';
        }
        addEvidence(buckets, category, {
          report: reportName,
          source: `commands[${commandIndex}].outputHead`,
          excerpt: command.outputHead.slice(0, 280)
        });
      });
  }

  return [...buckets.entries()]
    .map(([category, value]) => ({
      category,
      count: value.count,
      examples: value.examples,
      evidence: value.evidence
    }))
    .sort((a, b) => b.count - a.count);
}

function classifyProposalKind(category: string, evidence: ProposalEvidence[]): ProposalKind {
  const merged = `${category}\n${evidence.map((item) => item.excerpt).join('\n')}`.toLowerCase();
  if (
    category.includes('ai_execution') ||
    category.includes('preflight_write') ||
    merged.includes('prompt') ||
    merged.includes('missing step')
  ) {
    return 'template_text';
  }
  if (
    category.includes('scope_check') ||
    merged.includes('tsconfig') ||
    merged.includes('src/types') ||
    merged.includes('layout')
  ) {
    return 'template_skeleton';
  }
  return 'library_change';
}

function proposalMetadata(
  kind: ProposalKind,
  category: string
): { patchTargets: string[]; risk: ProposalRisk; expectedEffect: string[]; title: string; rationale: string } {
  if (kind === 'template_text') {
    return {
      patchTargets: ['packages/ztd-cli/templates/AGENTS.md', 'packages/ztd-cli/templates/tests/AGENTS.md'],
      risk: 'low',
      expectedEffect: [`Reduce recurring "${category}" failures`],
      title: `Clarify prompt execution rule for ${category}`,
      rationale: 'Observed repeated instruction-handling issues; tighten wording in template AGENTS.'
    };
  }
  if (kind === 'template_skeleton') {
    return {
      patchTargets: ['packages/ztd-cli/templates/README.md', 'packages/ztd-cli/templates/src/repositories/AGENTS.md'],
      risk: 'medium',
      expectedEffect: [`Reduce structural/layout-driven "${category}" failures`],
      title: `Adjust template skeleton guardrails for ${category}`,
      rationale: 'Observed failures point to placement/default-structure mismatch in generated projects.'
    };
  }
  return {
    patchTargets: ['packages/sql-contract/src', 'packages/ztd-cli/src'],
    risk: 'high',
    expectedEffect: [`Reduce capability/API-driven "${category}" failures`],
    title: `Plan library capability fix for ${category}`,
    rationale: 'Observed failures indicate constraints beyond template text/skeleton only.'
  };
}

function buildProposals(clusters: FailureCluster[]): Proposal[] {
  const proposals: Proposal[] = [];

  for (const cluster of clusters) {
    const evidence = cluster.evidence.slice(0, 3);
    const kind = classifyProposalKind(cluster.category, evidence);
    const meta = proposalMetadata(kind, cluster.category);
    proposals.push({
      kind,
      title: meta.title,
      rationale: `${meta.rationale} Observed ${cluster.count} occurrences.`,
      evidence,
      patch_targets: meta.patchTargets,
      expected_effect: meta.expectedEffect,
      risk: meta.risk
    });
    if (proposals.length >= 5) {
      break;
    }
  }

  if (!proposals.some((proposal) => proposal.kind === 'template_text') && clusters.length > 0) {
    const fallback = clusters[0];
    proposals.unshift({
      kind: 'template_text',
      title: `Clarify project rules from top cluster ${fallback.category}`,
      rationale: `Fallback template_text proposal derived from top observed cluster (${fallback.count} occurrences).`,
      evidence: fallback.evidence.slice(0, 3),
      patch_targets: ['packages/ztd-cli/templates/AGENTS.md'],
      expected_effect: [`Reduce recurrence of "${fallback.category}"`],
      risk: 'low'
    });
  }

  return proposals.slice(0, 5);
}

function hasPrimaryStop(reports: EvalReport[]): boolean {
  if (reports.length < 10) {
    return false;
  }
  const last = reports.slice(-10);
  const allSuccess = last.every((report) => report.success);
  const avg = last.reduce((sum, report) => sum + report.score_total, 0) / last.length;
  const min = Math.min(...last.map((report) => report.score_total));
  return allSuccess && avg >= 95 && min >= 90;
}

function hasSecondaryStop(clusters: FailureCluster[], reports: EvalReport[]): boolean {
  if (reports.length < 5) {
    return false;
  }
  const recent = reports.slice(-5);
  const recentFailures = new Set(
    recent.flatMap((report) => report.checks.filter((check) => isFailureRelevantCheck(check)).map((check) => check.name))
  );
  const knownTop = new Set(clusters.slice(0, 10).map((cluster) => cluster.category));
  for (const category of recentFailures) {
    if (!knownTop.has(category)) {
      return false;
    }
  }
  return true;
}

async function ensureLine(filePath: string, line: string): Promise<boolean> {
  const raw = await readUtf8File(filePath);
  if (raw.includes(line)) {
    return false;
  }
  const next = `${raw.trimEnd()}\n${line}\n`;
  await writeUtf8File(filePath, next);
  return true;
}

async function applyTopTemplateTextProposal(repoRoot: string, proposals: Proposal[]): Promise<LoopSummary['applied_proposal']> {
  const target = proposals.find((proposal) => proposal.kind === 'template_text' && proposal.risk === 'low');
  if (!target) {
    return {
      applied: false,
      notes: 'No low-risk template_text proposal found.'
    };
  }

  // One hypothesis, one fix: apply a single wording reinforcement line across prompt-rule docs.
  const changedFiles: string[] = [];
  const updates: Array<{ file: string; line: string }> = [
    {
      file: path.join(repoRoot, 'packages', 'ztd-cli', 'templates', 'AGENTS.md'),
      line: '- If a prompt includes an explicit command, run it first and verify output before additional edits.'
    },
    {
      file: path.join(repoRoot, 'packages', 'ztd-cli', 'templates', 'tests', 'AGENTS.md'),
      line: '- When a prompt requests a deterministic marker under `tests/`, execute and verify it before test changes.'
    }
  ];

  for (const update of updates) {
    const didChange = await ensureLine(update.file, update.line);
    if (didChange) {
      changedFiles.push(path.relative(repoRoot, update.file).replace(/\\/g, '/'));
    }
  }

  return {
    applied: true,
    title: target.title,
    kind: target.kind,
    patch_targets: target.patch_targets,
    notes:
      changedFiles.length > 0
        ? `Applied template_text proposal. Updated files: ${changedFiles.join(', ')}`
        : 'Proposal selected but target lines already present; no file content changes were needed.'
  };
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const runnerWallTimeoutMs = parseRunnerWallTimeoutMs(process.env.EVAL_RUNNER_WALL_TIMEOUT_MS);
  const reportPaths: string[] = [];
  const reports: EvalReport[] = [];
  const missingReports = new Map<string, RunnerMissingMeta>();
  const runtimeByReportPath = new Map<string, IterationRuntimeMeta>();
  const runnerExitCodeCounts: Record<string, number> = {};
  const tsNodeArgsBase = ['exec', 'ts-node', path.join(repoRoot, 'eval', 'runner.ts')];
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const runId = `${timestamp}-${process.pid}`;

  emitLoopEvent('loop_start', {
    run_id: runId,
    report_prefix: options.reportPrefix,
    loop_count: options.loopCount,
    scenario: options.scenario
  });

  for (let index = 1; index <= options.loopCount; index += 1) {
    const reportPath = path.resolve(repoRoot, `${options.reportPrefix}-${timestamp}-${String(index).padStart(2, '0')}.json`);
    const runnerLogPath =
      process.env.EVAL_RUNNER_LOG_PATH?.trim() || buildDefaultRunnerLogPath(repoRoot, options.reportPrefix, timestamp, index);
    const commandEnv: NodeJS.ProcessEnv = {
      ...process.env,
      EVAL_RUNNER_LOG_PATH: runnerLogPath
    };
    const args = [
      ...tsNodeArgsBase,
      '--case',
      options.scenario,
      '--scenario',
      options.scenario,
      '--report',
      reportPath
    ];
    if (options.keepWorkspace) {
      args.push('--keep-workspace');
    }

    const commandInvocation =
      os.platform() === 'win32'
        ? toWindowsCommand(args)
        : {
            command: 'pnpm',
            args
          };

    emitLoopEvent('iteration_prepare', {
      run_id: runId,
      iteration: index,
      report_path: reportPath,
      runner_cmd: `${commandInvocation.command} ${commandInvocation.args.join(' ')}`
    });

    emitLoopEvent('run_command_start', {
      run_id: runId,
      iteration: index
    });
    const runStartedAt = Date.now();
    const result = await runRunnerCommandWithWallTimeout({
      command: commandInvocation.command,
      args: commandInvocation.args,
      cwd: repoRoot,
      env: commandEnv,
      wallTimeoutMs: runnerWallTimeoutMs
    });
    const runnerLastEvent = await readRunnerLastEvent(runnerLogPath);
    const runnerExitCodeMismatch = detectRunnerExitCodeMismatch(result.exitCode, runnerLastEvent);
    const runnerElapsedMs = Date.now() - runStartedAt;
    const exitCodeKey = String(result.exitCode);
    runnerExitCodeCounts[exitCodeKey] = (runnerExitCodeCounts[exitCodeKey] ?? 0) + 1;
    emitLoopEvent('run_command_end', {
      run_id: runId,
      iteration: index,
      exit_code: result.exitCode,
      elapsed_ms: runnerElapsedMs,
      wall_timeout: result.wallTimedOut
    });
    if (result.exitCode === null) {
      throw new Error(`Iteration ${index} exited with null code.`);
    }

    const nextCommand = `pnpm exec ts-node ${path.join(repoRoot, 'eval', 'runner.ts')} --case ${options.scenario} --scenario ${options.scenario} --report ${reportPath}`;
    if (!existsSync(reportPath)) {
      emitLoopEvent('report_read_end', {
        run_id: runId,
        iteration: index,
        report_path: reportPath,
        exists: false,
        size_bytes: 0
      });
      const missingMeta: RunnerMissingMeta = {
        exitCode: result.exitCode,
        outputHead: result.log.outputHead,
        stdoutHead: result.stdout.slice(0, 2000),
        stderrHead: result.stderr.slice(0, 2000),
        nextCommand
      };
      missingReports.set(reportPath, missingMeta);
      runtimeByReportPath.set(reportPath, {
        runnerExitCode: result.exitCode,
        runnerElapsedMs,
        runnerReportWritten: false,
        runnerLogPath,
        runnerLastEvent,
        runnerReportExpectedPath: reportPath,
        runnerReportExists: false,
        runnerExitCodeMismatch,
        runnerWallTimeout: result.wallTimedOut,
        runnerWallTimeoutMs: result.wallTimeoutMs,
        runnerWallTimeoutNote: result.wallTimedOut ? 'no progress after run_command_start' : undefined
      });
      reportPaths.push(reportPath);
      reports.push(buildMissingEvalReport(options.scenario, reportPath, result.exitCode));
      continue;
    }

    emitLoopEvent('report_read_start', {
      run_id: runId,
      iteration: index,
      report_path: reportPath
    });
    const reportRaw = await readUtf8File(reportPath);
    emitLoopEvent('report_read_end', {
      run_id: runId,
      iteration: index,
      report_path: reportPath,
      exists: true,
      size_bytes: Buffer.byteLength(reportRaw, 'utf8')
    });
    const report = JSON.parse(reportRaw) as EvalReport;
    runtimeByReportPath.set(reportPath, {
      runnerExitCode: result.exitCode,
      runnerElapsedMs,
      runnerReportWritten: true,
      runnerLogPath,
      runnerLastEvent,
      runnerReportExpectedPath: reportPath,
      runnerReportExists: true,
      runnerExitCodeMismatch,
      runnerWallTimeout: result.wallTimedOut,
      runnerWallTimeoutMs: result.wallTimeoutMs,
      runnerWallTimeoutNote: result.wallTimedOut ? 'no progress after run_command_start' : undefined
    });
    reportPaths.push(reportPath);
    reports.push(report);
  }

  const passCount = reports.filter((report) => report.success).length;
  const scores = reports.map((report) => report.score_total);
  const durations = reports.map((report) => computeDurationMs(report));
  const preflightStats = computePreflightWriteStats(reports);
  const dirtyWorktreeStats = computeDirtyWorktreeStats(reports);
  const failureClusters = buildFailureClusters(reports, reportPaths);
  const proposals = buildProposals(failureClusters);
  const appliedProposal = await applyTopTemplateTextProposal(repoRoot, proposals);
  const runnerExitCodeMismatchCount = Array.from(runtimeByReportPath.values()).filter(
    (runtime) => runtime.runnerExitCodeMismatch
  ).length;

  const summary: LoopSummary = {
    generated_at: new Date().toISOString(),
    loop_count: reports.length,
    scenario: options.scenario,
    reports: reportPaths,
    iterations: reports.map((report, index) => {
      const runtimeMeta = runtimeByReportPath.get(reportPaths[index]);
      const failedCategories = report.checks.filter((check) => isFailureRelevantCheck(check)).map((check) => check.name);
      if (runtimeMeta?.runnerWallTimeout) {
        failedCategories.push('runner_wall_timeout');
      }
      return {
        index: index + 1,
        report_path: reportPaths[index],
        success: report.success,
        score_total: report.score_total,
        failed_categories: failedCategories,
        duration_ms: durations[index] ?? 0,
        runner_exit_code: runtimeMeta?.runnerExitCode ?? null,
        runner_elapsed_ms: runtimeMeta?.runnerElapsedMs ?? 0,
        runner_report_written: runtimeMeta?.runnerReportWritten ?? false,
        runner_log_path: runtimeMeta?.runnerLogPath,
        runner_last_event: runtimeMeta?.runnerLastEvent ?? '',
        runner_report_expected_path: runtimeMeta?.runnerReportExpectedPath ?? reportPaths[index],
        runner_report_exists: runtimeMeta?.runnerReportExists ?? false,
        runner_exit_code_mismatch: runtimeMeta?.runnerExitCodeMismatch ?? false,
        runner_wall_timeout: runtimeMeta?.runnerWallTimeout ?? false,
        runner_wall_timeout_ms: runtimeMeta?.runnerWallTimeoutMs ?? runnerWallTimeoutMs,
        runner_wall_timeout_note: runtimeMeta?.runnerWallTimeoutNote,
        runner_report_missing: missingReports.has(reportPaths[index])
          ? {
              exit_code: missingReports.get(reportPaths[index])!.exitCode,
              output_head: missingReports.get(reportPaths[index])!.outputHead,
              stdout_head: missingReports.get(reportPaths[index])!.stdoutHead,
              stderr_head: missingReports.get(reportPaths[index])!.stderrHead,
              next_command: missingReports.get(reportPaths[index])!.nextCommand
            }
          : undefined
      };
    }),
    aggregate: {
      pass_rate: reports.length === 0 ? 0 : passCount / reports.length,
      average_score: reports.length === 0 ? 0 : scores.reduce((sum, score) => sum + score, 0) / reports.length,
      min_score: scores.length === 0 ? 0 : Math.min(...scores),
      max_score: scores.length === 0 ? 0 : Math.max(...scores),
      runner_report_missing_count: missingReports.size,
      runner_exit_code_counts: runnerExitCodeCounts,
      loop_exit_code: Number(process.exitCode ?? 0),
      loop_completed: true,
      exit_code_note: 'runner_exit_code is per-iteration runner result; loop_exit_code indicates whether loop summary generation completed.',
      preflight_write_present_count: preflightStats.presentCount,
      preflight_write_executed_count: preflightStats.executedCount,
      preflight_write_skipped_count: preflightStats.skippedCount,
      dirty_worktree_present_count: dirtyWorktreeStats.presentCount,
      dirty_worktree_failed_count: dirtyWorktreeStats.failedCount,
      runner_exit_code_mismatch_count: runnerExitCodeMismatchCount,
      failure_clusters: failureClusters,
      failure_cluster_entropy: new Set(failureClusters.map((cluster) => cluster.category)).size,
      loop_latency_ms: {
        per_run: durations,
        median: percentile(durations, 50),
        p95: percentile(durations, 95)
      }
    },
    proposals,
    applied_proposal: appliedProposal,
    stop_conditions: {
      primary_met: hasPrimaryStop(reports),
      secondary_met: hasSecondaryStop(failureClusters, reports)
    }
  };

  const summaryPath = path.resolve(repoRoot, `${options.reportPrefix}-summary-${timestamp}.json`);
  await ensureDirectory(path.dirname(summaryPath));
  emitLoopEvent('summary_write_start', {
    run_id: runId,
    summary_path: summaryPath
  });
  await writeUtf8File(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  emitLoopEvent('summary_write_end', {
    run_id: runId,
    summary_path: summaryPath
  });
  emitLoopEvent('loop_done', {
    run_id: runId,
    exit_code: process.exitCode ?? 0,
    reports: reports.length
  });
  console.log(summaryPath);
}

run().catch((error) => {
  emitLoopEvent('loop_done', {
    run_id: 'unknown',
    exit_code: 1,
    error: error instanceof Error ? error.message : String(error)
  });
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
