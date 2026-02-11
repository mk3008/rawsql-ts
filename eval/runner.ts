import path from 'node:path';
import { appendFileSync, existsSync } from 'node:fs';
import { copyFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { runForbiddenRefsCheck } from './checks/forbidden_refs';
import { runScopeCheck } from './checks/scope_check';
import { runSqlRulesCheck } from './checks/sql_rules';
import { runTracePresenceCheck } from './checks/trace_presence';
import { runCommand, type CommandLog } from './lib/exec';
import { ensureDirectory, readUtf8File, removeDirectoryRecursive, writeUtf8File } from './lib/fs';
import { assertSandboxMode, buildCaseWorkspaceName, resolveEvalPaths } from './lib/guards';
import { computeScore, type CheckResult, type EvalReport, writeReport } from './lib/report';
import {
  assertWorkspaceDepFileLinks,
  copyLocalDepsToWorkspace,
  packLocalDeps,
  patchWorkspacePackageJson
} from './lib/local_deps';
import { diffWorkspaceSnapshots, snapshotWorkspaceTextFiles } from './lib/workspace_changes';

interface CliOptions {
  caseSlug: string;
  scenario: string;
  keepWorkspace: boolean;
  skipAi: boolean;
  reportPath: string;
}

const DEFAULT_CASE = 'crud-basic';
const DEFAULT_SCENARIO = 'crud-basic';
const DEFAULT_REPORT = path.join('eval', 'reports', 'latest.json');
const DEFAULT_SANDBOX_MODE = 'workspace-write';
const DEFAULT_LOCAL_DEPS = ['@rawsql-ts/shared-binder'];
const DEFAULT_CODEX_EXEC_TIMEOUT_MS = 45_000;
const EVAL_TEST_COMMAND = 'test:eval';
const EVAL_TEST_EXCLUDES = ['**/*.integration.test.*', '**/*testcontainers*'];
const EVAL_TEST_MODE: 'eval' = 'eval';
const EVAL_TEST_FALLBACK_POLICY: 'fail_fast_no_fallback' = 'fail_fast_no_fallback';
const EVAL_MARKER_RELATIVE_PATH = 'tests/__eval_ai_marker__.txt';
const MAIN_AI_MARKER_REQUIREMENT = [
  'First run this command exactly:',
  `Run: pwsh -NoProfile -Command "Set-Content -NoNewline -Path ./${EVAL_MARKER_RELATIVE_PATH} -Value ok; Get-Content -Raw ./${EVAL_MARKER_RELATIVE_PATH}"`,
  'Then continue with the existing CRUD instructions.'
].join('\n');
const PREFLIGHT_WRITE_PROMPT =
  'Run: pwsh -NoProfile -Command "Set-Content -NoNewline -Path ./__eval_probe_write.txt -Value ok; Get-Content -Raw ./__eval_probe_write.txt"';
const LOCAL_PREFLIGHT_COMMAND =
  'Set-Content -NoNewline -Path ./__eval_local_preflight.txt -Value ok; Get-Content -Raw ./__eval_local_preflight.txt';
const SCENARIO_PROMPTS: Record<string, string> = {
  'crud-basic': '01_crud.md',
  'crud-complex': '02_crud_complex.md',
  'dynamic-search': '03_dynamic_search.md'
};

interface EvalConfig {
  localDeps?: string[];
}

interface CommandExecutionDetails {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  log: CommandLog;
  timedOut?: boolean;
  timeoutMs?: number;
}

interface CodexRetryResult {
  result: CommandExecutionDetails;
  retried: boolean;
}

interface CodexHomeBootstrapMeta {
  copied_paths: string[];
  skipped_paths: string[];
  reason: string;
}

interface GitWorktreeState {
  observed: boolean;
  dirty: boolean;
  count: number;
  excerpt: string[];
  commandExitCode: number | null;
  stdoutHead: string;
  stderrHead: string;
}

interface AiBlockerMeta {
  detected: boolean;
  kind: 'read_only' | 'none';
  excerpt: string;
}

interface AiTouchAnalysis {
  touchedFilesCount: number;
  nonMarkerTouchedCount: number;
  markerOnly: boolean;
  effectiveWrite: boolean;
}

interface RunnerEventLogger {
  logPath?: string;
}

function createSkippedCheck(name: string, reason: string): CheckResult {
  return {
    name,
    passed: true,
    violations: 0,
    details: [reason],
    meta: {
      skipped: true
    }
  };
}

let didCodexHelpCheck = false;

function sanitizeEventValue(value: unknown): string {
  return String(value).replace(/\s+/g, ' ').trim();
}

function formatRunnerEventLine(event: string, fields: Record<string, unknown> = {}): string {
  const parts = [`[eval-runner] event=${sanitizeEventValue(event)}`, `ts=${new Date().toISOString()}`];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }
    parts.push(`${key}=${sanitizeEventValue(value)}`);
  }
  return parts.join(' ');
}

function emitRunnerEvent(logger: RunnerEventLogger, event: string, fields: Record<string, unknown> = {}): void {
  const line = formatRunnerEventLine(event, fields);
  console.log(line);
  if (!logger.logPath) {
    return;
  }
  try {
    appendFileSync(logger.logPath, `${line}\n`, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[eval-runner] event=log_write_error ts=${new Date().toISOString()} message=${sanitizeEventValue(message)}`);
  }
}

async function readGitWorktreeState(
  commandLogs: CommandLog[],
  repoRoot: string,
  env?: NodeJS.ProcessEnv
): Promise<GitWorktreeState> {
  const gitStatus = await runAndTrackAllowFailureWithDetails(commandLogs, 'git', ['status', '--porcelain'], repoRoot, env);
  const lines = gitStatus.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const observed = gitStatus.exitCode === 0;
  const dirty = observed ? lines.length > 0 : false;
  return {
    observed,
    dirty,
    count: lines.length,
    excerpt: lines.slice(0, 10),
    commandExitCode: gitStatus.exitCode,
    stdoutHead: gitStatus.stdout.slice(0, 2000),
    stderrHead: gitStatus.stderr.slice(0, 2000)
  };
}

async function ensureCodexHelpCheck(
  commandLogs: CommandLog[],
  codexBin: string,
  repoRoot: string,
  codexEnv: NodeJS.ProcessEnv
): Promise<void> {
  if (didCodexHelpCheck) {
    commandLogs.push({
      command: codexBin,
      args: ['exec', '--help'],
      cwd: repoRoot,
      exitCode: 0,
      outputHead: 'Skipped codex exec --help (already checked in this process).'
    });
    return;
  }

  await runAndTrackAllowFailure(commandLogs, codexBin, ['exec', '--help'], repoRoot, codexEnv);
  didCodexHelpCheck = true;
}

function detectAiExecutionBlocker(stdoutHead: string, stderrHead: string): AiBlockerMeta {
  const combined = `${stdoutHead}\n${stderrHead}`.toLowerCase();
  const ruleMatched =
    (combined.includes('write access is denied in this environment') && combined.includes('read-only sandbox')) ||
    combined.includes('attempts to create/update files via `apply_patch` were rejected');
  if (!ruleMatched) {
    return {
      detected: false,
      kind: 'none',
      excerpt: ''
    };
  }

  const excerptSource = stdoutHead || stderrHead;
  const excerpt = excerptSource.slice(0, 280);
  return {
    detected: true,
    kind: 'read_only',
    excerpt
  };
}

function normalizeEvalPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
}

function isEvalMarkerPath(filePath: string): boolean {
  const normalized = normalizeEvalPath(filePath);
  return normalized === EVAL_MARKER_RELATIVE_PATH || normalized.endsWith(`/${EVAL_MARKER_RELATIVE_PATH}`);
}

function analyzeAiTouchedFiles(touchedFiles: string[]): AiTouchAnalysis {
  const touchedFilesCount = touchedFiles.length;
  const nonMarkerTouchedCount = touchedFiles.filter((filePath) => !isEvalMarkerPath(filePath)).length;
  const markerOnly = touchedFilesCount > 0 && nonMarkerTouchedCount === 0;
  return {
    touchedFilesCount,
    nonMarkerTouchedCount,
    markerOnly,
    effectiveWrite: touchedFilesCount > 0 && !markerOnly
  };
}

function resolveCommandInvocation(
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv
): { command: string; args: string[] } {
  if (process.platform === 'win32' && (command === 'pnpm' || command === 'codex')) {
    const appData = env?.APPDATA ?? process.env.APPDATA ?? '';
    const shimCandidate = appData ? path.join(appData, 'npm', `${command}.cmd`) : `${command}.cmd`;
    const shim = existsSync(shimCandidate) ? shimCandidate : `${command}.cmd`;
    const shimQuoted = /[ \t"]/g.test(shim) ? `"${shim.replace(/"/g, '\\"')}"` : shim;
    const quotedArgs = args.map((item) => (/[ \t"]/g.test(item) ? `"${item.replace(/"/g, '\\"')}"` : item)).join(' ');
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', `${shimQuoted} ${quotedArgs}`.trim()]
    };
  }

  return { command, args };
}

function readHeaderSandbox(outputHead: string): string | null {
  const match = outputHead.match(/sandbox:\s*([^\r\n]+)/i);
  return match?.[1]?.trim() ?? null;
}

function readHeaderWorkdir(outputHead: string): string | null {
  const match = outputHead.match(/workdir:\s*([^\r\n]+)/i);
  return match?.[1]?.trim() ?? null;
}

function parseCodexExecTimeoutMs(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CODEX_EXEC_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

function buildOutputHead(stdout: string, stderr: string): string {
  const merged = [stdout.trim(), stderr.trim()].filter((part) => part.length > 0).join('\n');
  if (merged.length === 0) {
    return '';
  }
  return merged.split(/\r?\n/).slice(0, 30).join('\n');
}

function parseArgs(argv: string[]): CliOptions {
  let caseSlug = DEFAULT_CASE;
  let scenario = DEFAULT_SCENARIO;
  let keepWorkspace = false;
  let skipAi = false;
  let reportPath = DEFAULT_REPORT;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--case') {
      caseSlug = argv[index + 1] ?? DEFAULT_CASE;
      index += 1;
      continue;
    }
    if (token === '--keep-workspace') {
      keepWorkspace = true;
      continue;
    }
    if (token === '--scenario') {
      scenario = argv[index + 1] ?? DEFAULT_SCENARIO;
      index += 1;
      continue;
    }
    if (token === '--skip-ai') {
      skipAi = true;
      continue;
    }
    if (token === '--report') {
      reportPath = argv[index + 1] ?? DEFAULT_REPORT;
      index += 1;
      continue;
    }
  }

  return { caseSlug, scenario, keepWorkspace, skipAi, reportPath };
}

async function runAndTrack(
  commandLogs: CommandLog[],
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  stdinText?: string,
  timeoutMs?: number
): Promise<void> {
  const invocation = resolveCommandInvocation(command, args, env);
  const result = await runCommand({
    command: invocation.command,
    args: invocation.args,
    cwd,
    env,
    stdinText,
    timeoutMs
  });
  commandLogs.push(result.log);
  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')} (exit=${result.exitCode ?? 'null'})\n${result.log.outputHead}`
    );
  }
}

async function runAndTrackAllowFailureWithDetails(
  commandLogs: CommandLog[],
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  stdinText?: string,
  timeoutMs?: number
): Promise<CommandExecutionDetails> {
  const invocation = resolveCommandInvocation(command, args, env);
  const result = await runCommand({
    command: invocation.command,
    args: invocation.args,
    cwd,
    env,
    stdinText,
    timeoutMs
  });
  commandLogs.push(result.log);
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    log: result.log
  };
}

async function runCodexCommandWithTimeout(
  commandLogs: CommandLog[],
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  stdinText?: string,
  timeoutMs: number = DEFAULT_CODEX_EXEC_TIMEOUT_MS
): Promise<CommandExecutionDetails> {
  const invocation = resolveCommandInvocation('codex', args, env);
  return new Promise<CommandExecutionDetails>((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      env,
      shell: false
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finalize = (rawExitCode: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      const exitCode = timedOut ? 124 : rawExitCode;
      const log: CommandLog = {
        command: invocation.command,
        args: invocation.args,
        cwd,
        exitCode,
        outputHead: buildOutputHead(stdout, stderr)
      };
      commandLogs.push(log);
      resolve({
        exitCode,
        stdout,
        stderr,
        log,
        timedOut,
        timeoutMs
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

    if (stdinText !== undefined) {
      child.stdin.write(stdinText);
      child.stdin.end();
    }

    child.on('close', (exitCode: number | null) => {
      finalize(exitCode);
    });

    timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }
      timedOut = true;
      stderr += `codex_exec_timeout: exceeded ${timeoutMs}ms\n`;
      child.kill('SIGKILL');
      finalize(124);
    }, timeoutMs);
  });
}

function isNonRetryableCodexError(stdout: string, stderr: string): boolean {
  const merged = `${stdout}\n${stderr}`;
  return /401 Unauthorized|model_not_found|unexpected argument/i.test(merged);
}

async function sleepMs(durationMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function runCodexExecWithRetry(
  commandLogs: CommandLog[],
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  stdinText?: string,
  timeoutMs: number = DEFAULT_CODEX_EXEC_TIMEOUT_MS,
  onRetryStart?: () => void,
  onRetryEnd?: (retried: boolean) => void
): Promise<CodexRetryResult> {
  const first = await runCodexCommandWithTimeout(commandLogs, args, cwd, env, stdinText, timeoutMs);
  const retryOptIn = (env?.EVAL_CODEX_RETRY ?? process.env.EVAL_CODEX_RETRY) === '1';
  if (!retryOptIn) {
    return { result: first, retried: false };
  }
  onRetryStart?.();

  const transientFailure =
    (first.exitCode ?? 1) !== 0 && !isNonRetryableCodexError(first.stdout, first.stderr) && first.exitCode !== null;
  if (!transientFailure) {
    onRetryEnd?.(false);
    return { result: first, retried: false };
  }

  await sleepMs(2000);
  const second = await runCodexCommandWithTimeout(commandLogs, args, cwd, env, stdinText, timeoutMs);
  onRetryEnd?.(true);
  return { result: second, retried: true };
}

async function runAndTrackAllowFailure(
  commandLogs: CommandLog[],
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  stdinText?: string,
  timeoutMs?: number
): Promise<number | null> {
  try {
    await runAndTrack(commandLogs, command, args, cwd, env, stdinText, timeoutMs);
    return 0;
  } catch {
    const latest = commandLogs[commandLogs.length - 1];
    return latest?.exitCode ?? 1;
  }
}

async function ensureEvalCodexHome(codexHome: string): Promise<void> {
  await ensureDirectory(codexHome);
  const agentsPath = path.join(codexHome, 'AGENTS.md');
  const minimalAgents = ['# Eval Codex Home', '', 'Use only workspace-local instructions for this evaluation.', ''].join(
    '\n'
  );
  await writeUtf8File(agentsPath, minimalAgents);
}

function isAuthBootstrapCandidate(fileName: string): boolean {
  const normalized = fileName.toLowerCase();
  if (normalized === 'agents.md' || normalized === 'config.toml') {
    return false;
  }
  if (normalized.includes('auth') || normalized.includes('token') || normalized.includes('credential')) {
    return true;
  }
  return false;
}

async function bootstrapCodexHomeAuth(
  globalCodexHome: string,
  evalCodexHome: string
): Promise<CodexHomeBootstrapMeta> {
  const copied_paths: string[] = [];
  const skipped_paths: string[] = [];

  if (!existsSync(globalCodexHome)) {
    return {
      copied_paths,
      skipped_paths,
      reason: `Not observed: global CODEX_HOME not found (${globalCodexHome}).`
    };
  }

  const entries = await readdir(globalCodexHome, { withFileTypes: true });
  const candidates = entries.filter((entry) => entry.isFile() && isAuthBootstrapCandidate(entry.name));
  if (candidates.length === 0) {
    return {
      copied_paths,
      skipped_paths,
      reason: 'Not observed: no allowlisted auth-related files found in global CODEX_HOME.'
    };
  }

  for (const entry of candidates) {
    const sourcePath = path.join(globalCodexHome, entry.name);
    const targetPath = path.join(evalCodexHome, entry.name);
    if (existsSync(targetPath)) {
      skipped_paths.push(`${entry.name}: already exists in eval CODEX_HOME`);
      continue;
    }
    await copyFile(sourcePath, targetPath);
    copied_paths.push(entry.name);
  }

  return {
    copied_paths,
    skipped_paths,
    reason: 'Copied only allowlisted auth-related files from global CODEX_HOME (AGENTS.md/config.toml excluded).'
  };
}

async function loadEvalConfig(repoRoot: string): Promise<EvalConfig> {
  const configPath = path.join(repoRoot, 'eval', 'config.json');
  if (!existsSync(configPath)) {
    return {};
  }
  const raw = await readUtf8File(configPath);
  return JSON.parse(raw) as EvalConfig;
}

async function run(): Promise<void> {
  const startedAt = new Date();
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const evalPaths = resolveEvalPaths(process.env);
  const caseFolder = buildCaseWorkspaceName(options.caseSlug, startedAt);
  const workspacePath = path.join(evalPaths.workspaceRoot, caseFolder);
  const reportPath = path.resolve(repoRoot, options.reportPath);
  const sandboxMode = process.env.EVAL_SANDBOX_MODE ?? DEFAULT_SANDBOX_MODE;
  const evalConfig = await loadEvalConfig(repoRoot);
  const requestedLocalDeps = Array.isArray(evalConfig.localDeps) ? evalConfig.localDeps : DEFAULT_LOCAL_DEPS;
  const depsCacheDir = path.join(repoRoot, 'eval', '_deps_cache');

  const codexBin = process.env.CODEX_BIN ?? 'codex';
  const pnpmBin = process.env.PNPM_BIN ?? 'pnpm';
  const ztdInitEntrypoint = path.join(repoRoot, 'eval', 'lib', 'ztd_init_entry.ts');
  const promptFile = SCENARIO_PROMPTS[options.scenario] ?? SCENARIO_PROMPTS[DEFAULT_SCENARIO];
  const promptPath = path.join(repoRoot, 'eval', 'prompts', promptFile);

  const commandLogs: CommandLog[] = [];
  const checks: CheckResult[] = [];
  let success = false;
  let errorMessage: string | undefined;
  let installExit: number | null = null;
  let typecheckExit: number | null = null;
  let testExit: number | null = null;
  let testFallbackReason: string | undefined;
  let aiExit: number | null = null;
  let aiTouchedFiles: string[] = [];
  let aiStdoutHead = '';
  let aiStderrHead = '';
  let aiCommandLine = '';
  let gitWorktreeState: GitWorktreeState = {
    observed: false,
    dirty: false,
    count: 0,
    excerpt: [],
    commandExitCode: null,
    stdoutHead: '',
    stderrHead: ''
  };
  const traceFilePath = path.join(workspacePath, 'tmp', 'eval-trace-events.jsonl');
  const globalCodexHome = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.codex');
  const runnerLogPathRaw = process.env.EVAL_RUNNER_LOG_PATH?.trim();
  const runnerLogPath = runnerLogPathRaw ? path.resolve(repoRoot, runnerLogPathRaw) : undefined;
  const runnerLogger: RunnerEventLogger = { logPath: runnerLogPath };
  let codexHomeBootstrap: CodexHomeBootstrapMeta = {
    copied_paths: [],
    skipped_paths: [],
    reason: 'Not executed.'
  };

  assertSandboxMode(sandboxMode);
  await ensureDirectory(evalPaths.workspaceRoot);
  await ensureDirectory(path.dirname(reportPath));
  if (runnerLogPath) {
    await ensureDirectory(path.dirname(runnerLogPath));
  }
  emitRunnerEvent(runnerLogger, 'runner_start', {
    case: options.caseSlug,
    scenario: options.scenario,
    report_path: reportPath,
    workspace_path: workspacePath
  });
  await ensureEvalCodexHome(evalPaths.codexHome);
  codexHomeBootstrap = await bootstrapCodexHomeAuth(globalCodexHome, evalPaths.codexHome);

  const codexEnv: NodeJS.ProcessEnv = {
    ...process.env,
    CODEX_HOME: evalPaths.codexHome
  };

  try {
    emitRunnerEvent(runnerLogger, 'preflight_start');
    emitRunnerEvent(runnerLogger, 'ai_help_start');
    await ensureCodexHelpCheck(commandLogs, codexBin, repoRoot, codexEnv);
    emitRunnerEvent(runnerLogger, 'ai_help_end');
    gitWorktreeState = await readGitWorktreeState(commandLogs, repoRoot, codexEnv);
    const requireCleanTree = (codexEnv.EVAL_REQUIRE_CLEAN_TREE ?? process.env.EVAL_REQUIRE_CLEAN_TREE) === '1';
    const cleanTreeViolation = requireCleanTree && gitWorktreeState.dirty;
    checks.push({
      name: 'dirty_worktree',
      passed: !cleanTreeViolation,
      violations: cleanTreeViolation ? 1 : 0,
      details: cleanTreeViolation
        ? ['dirty_worktree_required_clean']
        : gitWorktreeState.observed && gitWorktreeState.dirty
          ? ['dirty_worktree_detected_warning']
          : gitWorktreeState.observed
            ? []
            : ['dirty_worktree_not_observed'],
      meta: {
        git_worktree_dirty: gitWorktreeState.dirty,
        git_worktree_dirty_count: gitWorktreeState.count,
        git_worktree_dirty_excerpt: gitWorktreeState.excerpt,
        require_clean_tree: requireCleanTree,
        observed: gitWorktreeState.observed,
        command_exit_code: gitWorktreeState.commandExitCode,
        stdout_head: gitWorktreeState.stdoutHead,
        stderr_head: gitWorktreeState.stderrHead
      }
    });
    if (cleanTreeViolation) {
      emitRunnerEvent(runnerLogger, 'preflight_end', { passed: false, reason: 'dirty_worktree_required_clean' });
      errorMessage = 'dirty_worktree_required_clean';
      process.exitCode = 1;
      return;
    }

    await ensureDirectory(workspacePath);

    // Run ztd init from source with a fixed non-interactive prompter.
    await runAndTrack(
      commandLogs,
      pnpmBin,
      ['--dir', repoRoot, 'exec', 'ts-node', ztdInitEntrypoint, workspacePath],
      repoRoot,
      codexEnv
    );
    emitRunnerEvent(runnerLogger, 'preflight_end', { passed: true });

    if (!options.skipAi) {
      emitRunnerEvent(runnerLogger, 'ai_start');
      const localPreflightResult = await runAndTrackAllowFailureWithDetails(
        commandLogs,
        'pwsh',
        ['-NoProfile', '-Command', LOCAL_PREFLIGHT_COMMAND],
        workspacePath,
        codexEnv
      );
      const localPreflightPath = path.join(workspacePath, '__eval_local_preflight.txt');
      const localPreflightExists = existsSync(localPreflightPath);
      const localPreflightContent = localPreflightExists ? await readUtf8File(localPreflightPath) : '';
      const localPreflightPassed =
        localPreflightResult.exitCode === 0 && localPreflightExists && localPreflightContent === 'ok';
      checks.push({
        name: 'local_preflight',
        passed: localPreflightPassed,
        violations: localPreflightPassed ? 0 : 1,
        details: localPreflightPassed ? [] : ['local_preflight_failed'],
        meta: {
          exitCode: localPreflightResult.exitCode,
          stdout_head: localPreflightResult.stdout.slice(0, 2000),
          stderr_head: localPreflightResult.stderr.slice(0, 2000),
          local_exists: localPreflightExists,
          local_content: localPreflightContent
        }
      });
      if (!localPreflightPassed) {
        checks.push({
          name: 'ai_execution',
          passed: false,
          violations: 1,
          details: ['local_preflight_failed'],
          meta: {
            exitCode: null,
            touchedFilesCount: 0,
            touchedFilesSample: [],
            marker_file_exists: false,
            marker_file_content: '',
            marker_only: false,
            non_marker_touched_count: 0,
            headerSandbox: null,
            effectiveWrite: false,
            command: '',
            stdout_head: '',
            stderr_head: ''
          }
        });
        errorMessage = 'local_preflight_failed';
        emitRunnerEvent(runnerLogger, 'ai_end', { passed: false, reason: 'local_preflight_failed' });
        return;
      }

      const preflightArgs = [
        'exec',
        '--cd',
        workspacePath,
        '--skip-git-repo-check',
        '--full-auto',
        '--sandbox',
        sandboxMode,
        '-'
      ];
      const preflightWriteOptIn = (codexEnv.EVAL_PREFLIGHT_WRITE ?? process.env.EVAL_PREFLIGHT_WRITE) === '1';
      if (preflightWriteOptIn) {
        emitRunnerEvent(runnerLogger, 'ai_preflight_write_start');
        const preflightResult = await runAndTrackAllowFailureWithDetails(
          commandLogs,
          codexBin,
          preflightArgs,
          repoRoot,
          codexEnv,
          PREFLIGHT_WRITE_PROMPT,
          120000
        );
        const preflightProbePath = path.join(workspacePath, '__eval_probe_write.txt');
        const preflightLocalExists = existsSync(preflightProbePath);
        const preflightLocalContent = preflightLocalExists ? await readUtf8File(preflightProbePath) : '';
        const preflightPassed =
          preflightResult.exitCode === 0 && preflightLocalExists && preflightLocalContent === 'ok';
        checks.push({
          name: 'preflight_write',
          passed: preflightPassed,
          violations: preflightPassed ? 0 : 1,
          details: preflightPassed ? [] : ['preflight_write_observed_failure'],
          meta: {
            exitCode: preflightResult.exitCode,
            stdout_head: preflightResult.stdout.slice(0, 2000),
            stderr_head: preflightResult.stderr.slice(0, 2000),
            header_workdir: readHeaderWorkdir(preflightResult.log.outputHead),
            local_exists: preflightLocalExists,
            local_content: preflightLocalContent,
            skipped: false
          }
        });
        emitRunnerEvent(runnerLogger, 'ai_preflight_write_end', { exit_code: preflightResult.exitCode ?? 'null' });
      } else {
        emitRunnerEvent(runnerLogger, 'ai_preflight_write_skip');
        commandLogs.push({
          command: codexBin,
          args: preflightArgs,
          cwd: repoRoot,
          exitCode: 0,
          outputHead: 'Skipped preflight_write codex exec (skipped=true; set EVAL_PREFLIGHT_WRITE=1 to enable).'
        });
        checks.push({
          name: 'preflight_write',
          passed: true,
          violations: 0,
          details: ['preflight_write skipped by default'],
          meta: {
            exitCode: null,
            stdout_head: '',
            stderr_head: '',
            header_workdir: null,
            local_exists: false,
            local_content: '',
            skipped: true
          }
        });
      }

      const beforeAiSnapshot = await snapshotWorkspaceTextFiles(workspacePath);
      const promptText = await readUtf8File(promptPath);
      const aiPrompt = `${MAIN_AI_MARKER_REQUIREMENT}\n\n${promptText}`;
      const aiLogIndex = commandLogs.length;
      emitRunnerEvent(runnerLogger, 'ai_exec_start');
      const codexExecTimeoutMs = parseCodexExecTimeoutMs(codexEnv.EVAL_CODEX_EXEC_TIMEOUT_MS);
      const aiExecution = await runCodexExecWithRetry(
        commandLogs,
        [
          'exec',
          '--cd',
          workspacePath,
          '--skip-git-repo-check',
          '--full-auto',
          '--sandbox',
          sandboxMode,
          '-'
        ],
        repoRoot,
        codexEnv,
        aiPrompt,
        codexExecTimeoutMs,
        () => emitRunnerEvent(runnerLogger, 'ai_retry_start'),
        (retried) => emitRunnerEvent(runnerLogger, 'ai_retry_end', { retried })
      );
      const aiResult = aiExecution.result;
      aiExit = aiResult.exitCode;
      const codexExecTimedOut = aiResult.timedOut === true;
      emitRunnerEvent(runnerLogger, 'ai_exec_end', { exit_code: aiExit ?? 'null' });
      aiStdoutHead = aiResult.stdout.slice(0, 2000);
      aiStderrHead = aiResult.stderr.slice(0, 2000);
      const afterAiSnapshot = await snapshotWorkspaceTextFiles(workspacePath);
      aiTouchedFiles = diffWorkspaceSnapshots(beforeAiSnapshot, afterAiSnapshot).touched;
      const markerPath = path.join(workspacePath, ...EVAL_MARKER_RELATIVE_PATH.split('/'));
      const markerFileExists = existsSync(markerPath);
      const markerFileContent = markerFileExists ? await readUtf8File(markerPath) : '';
      const aiCommandLog = commandLogs[aiLogIndex];
      aiCommandLine = `${aiCommandLog?.command ?? ''} ${(aiCommandLog?.args ?? []).join(' ')}`.trim();
      const touchAnalysis = analyzeAiTouchedFiles(aiTouchedFiles);
      const blockerMeta = detectAiExecutionBlocker(aiStdoutHead, aiStderrHead);
      const aiPassed = aiExit === 0 && touchAnalysis.effectiveWrite && !blockerMeta.detected;
      checks.push({
        name: 'ai_execution',
        passed: aiPassed,
        violations: aiPassed ? 0 : 1,
        details: aiPassed
          ? []
          : aiExit !== 0
            ? [
                `codex exec failed (exit=${aiExit ?? 'null'})`,
                aiCommandLog?.outputHead ?? 'No output captured.'
              ]
            : blockerMeta.detected
              ? [`ai blocker detected (${blockerMeta.kind})`, blockerMeta.excerpt]
            : touchAnalysis.markerOnly
              ? ['codex exec touched only eval marker file; non-marker changes were not observed']
            : ['codex exec exited 0 but no workspace changes were observed'],
        meta: {
          exitCode: aiExit,
          touchedFilesCount: touchAnalysis.touchedFilesCount,
          touchedFilesSample: aiTouchedFiles.slice(0, 20),
          marker_file_exists: markerFileExists,
          marker_file_content: markerFileContent,
          marker_only: touchAnalysis.markerOnly,
          non_marker_touched_count: touchAnalysis.nonMarkerTouchedCount,
          headerSandbox: readHeaderSandbox(aiCommandLog?.outputHead ?? ''),
          effectiveWrite: touchAnalysis.effectiveWrite,
          command: aiCommandLine,
          stdout_head: aiStdoutHead,
          stderr_head: aiStderrHead,
          blocker_detected: blockerMeta.detected,
          blocker_kind: blockerMeta.kind,
          blocker_excerpt: blockerMeta.excerpt,
          retried: aiExecution.retried,
          codex_exec_timeout: codexExecTimedOut,
          codex_exec_timeout_ms: codexExecTimedOut ? aiResult.timeoutMs ?? codexExecTimeoutMs : null,
          codex_exec_timeout_note: codexExecTimedOut
            ? `codex exec timed out after ${aiResult.timeoutMs ?? codexExecTimeoutMs}ms`
            : null
        }
      });
      emitRunnerEvent(runnerLogger, 'ai_end', { passed: aiPassed, exit_code: aiExit ?? 'null' });
    } else {
      emitRunnerEvent(runnerLogger, 'ai_start', { skipped: true });
      checks.push({
        name: 'local_preflight',
        passed: true,
        violations: 0,
        details: ['AI step skipped'],
        meta: {
          exitCode: null,
          stdout_head: '',
          stderr_head: '',
          local_exists: false,
          local_content: ''
        }
      });
      checks.push({
        name: 'preflight_write',
        passed: true,
        violations: 0,
        details: ['AI step skipped'],
        meta: {
          exitCode: null,
          stdout_head: '',
          stderr_head: '',
          local_exists: false,
          local_content: ''
        }
      });
      checks.push({
        name: 'ai_execution',
        passed: true,
        violations: 0,
        details: ['AI step skipped'],
        meta: {
          exitCode: null,
          touchedFilesCount: 0,
          touchedFilesSample: [],
          marker_file_exists: false,
          marker_file_content: '',
          marker_only: false,
          non_marker_touched_count: 0,
          headerSandbox: null,
          effectiveWrite: false,
          command: '',
          stdout_head: '',
          stderr_head: ''
        }
      });
      emitRunnerEvent(runnerLogger, 'ai_end', { skipped: true, passed: true });
    }

    if (requestedLocalDeps.length > 0) {
      const packed = await packLocalDeps(repoRoot, depsCacheDir, requestedLocalDeps, codexEnv);
      commandLogs.push(...packed.commandLogs);
      const copiedDeps = await copyLocalDepsToWorkspace(workspacePath, packed.tgzMap);
      const patchResult = await patchWorkspacePackageJson(workspacePath, copiedDeps);
      await assertWorkspaceDepFileLinks(workspacePath, patchResult.patched);

      checks.push({
        name: 'local_deps_injection',
        passed: true,
        violations: 0,
        details: [],
        meta: {
          requestedPkgs: requestedLocalDeps,
          packedPkgs: Object.keys(packed.tgzMap),
          copiedFiles: copiedDeps,
          patchedKeys: patchResult.patched,
          skippedKeys: patchResult.skipped
        }
      });
    } else {
      checks.push({
        name: 'local_deps_injection',
        passed: true,
        violations: 0,
        details: ['disabled by config'],
        meta: {
          requestedPkgs: [],
          packedPkgs: [],
          copiedFiles: {},
          patchedKeys: [],
          skippedKeys: []
        }
      });
    }

    const commandEnv: NodeJS.ProcessEnv = {
      ...codexEnv,
      ZTD_TRACE_FILE: traceFilePath
    };

    emitRunnerEvent(runnerLogger, 'install_start');
    installExit = await runAndTrackAllowFailure(
      commandLogs,
      pnpmBin,
      ['--dir', workspacePath, 'install'],
      repoRoot,
      commandEnv
    );
    emitRunnerEvent(runnerLogger, 'install_end', { exit_code: installExit ?? 'null' });
    emitRunnerEvent(runnerLogger, 'typecheck_start');
    typecheckExit = await runAndTrackAllowFailure(
      commandLogs,
      pnpmBin,
      ['--dir', workspacePath, 'typecheck'],
      repoRoot,
      commandEnv
    );
    emitRunnerEvent(runnerLogger, 'typecheck_end', { exit_code: typecheckExit ?? 'null' });
    emitRunnerEvent(runnerLogger, 'test_start');
    testExit = await runAndTrackAllowFailure(
      commandLogs,
      pnpmBin,
      ['--dir', workspacePath, EVAL_TEST_COMMAND],
      repoRoot,
      commandEnv
    );
    if (testExit !== 0) {
      testFallbackReason = `${EVAL_TEST_COMMAND} failed (exit=${testExit}); fallback disabled by policy (${EVAL_TEST_FALLBACK_POLICY})`;
    }
    emitRunnerEvent(runnerLogger, 'test_end', { exit_code: testExit ?? 'null' });

    emitRunnerEvent(runnerLogger, 'checks_start');
    checks.push(runScopeCheck(aiTouchedFiles, !options.skipAi));
    checks.push(await runForbiddenRefsCheck(workspacePath, repoRoot, commandLogs));
    checks.push(createSkippedCheck('sql_composition', 'temporarily skipped: check module not found'));
    checks.push(createSkippedCheck('sql_client_runnable', 'temporarily skipped: check module not found'));
    checks.push(await runSqlRulesCheck(workspacePath));
    checks.push(createSkippedCheck('contract_drift', 'temporarily skipped: check module not found'));
    checks.push(createSkippedCheck('repository_boundary', 'temporarily skipped: check module not found'));
    checks.push(await runTracePresenceCheck(traceFilePath));
    checks.push(createSkippedCheck('catalog_trace_quality', 'temporarily skipped: check module not found'));
    const blockingChecks = checks.filter((item) => item.name !== 'preflight_write');
    success = blockingChecks.every((item) => item.passed) && installExit === 0 && typecheckExit === 0 && testExit === 0;
    if (!success) {
      const failures: string[] = [];
      if (installExit !== 0) {
        failures.push(`install failed (exit=${installExit})`);
      }
      if (typecheckExit !== 0) {
        failures.push(`typecheck failed (exit=${typecheckExit})`);
      }
      if (testExit !== 0) {
        failures.push(`test failed (exit=${testExit})`);
      }
      if (blockingChecks.some((item) => !item.passed)) {
        failures.push('check failures detected');
      }
      errorMessage = failures.join('; ');
    }
    emitRunnerEvent(runnerLogger, 'checks_end', { passed: success });
  } catch (error) {
    emitRunnerEvent(runnerLogger, 'checks_end', {
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
    success = false;
    errorMessage = error instanceof Error ? error.message : String(error);
    if (!checks.some((item) => item.name === 'local_deps_injection')) {
      checks.push({
        name: 'local_deps_injection',
        passed: false,
        violations: 1,
        details: [errorMessage]
      });
    }
  } finally {
    const scoreBreakdown = computeScore(installExit, typecheckExit, testExit, checks);
    const report: EvalReport = {
      caseSlug: options.caseSlug,
      workspace_path: workspacePath,
      cwd_used: workspacePath,
      codex_home: evalPaths.codexHome,
      sandbox_mode: sandboxMode,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      commands: commandLogs,
      checks,
      codex_home_bootstrap: codexHomeBootstrap,
      meta: {
        test_command: EVAL_TEST_COMMAND,
        test_excludes: EVAL_TEST_EXCLUDES,
        test_mode: EVAL_TEST_MODE,
        test_fallback_policy: EVAL_TEST_FALLBACK_POLICY,
        test_fallback_attempted: false,
        test_fallback_reason: testFallbackReason
      },
      score_breakdown: scoreBreakdown,
      score_total: scoreBreakdown.total,
      success,
      error: errorMessage
    };

    try {
      emitRunnerEvent(runnerLogger, 'report_write_start', { report_path: reportPath });
      await writeReport(reportPath, report);
      emitRunnerEvent(runnerLogger, 'report_write_end', { report_path: reportPath });
      if (!options.keepWorkspace) {
        await removeDirectoryRecursive(workspacePath);
      }
    } finally {
      emitRunnerEvent(runnerLogger, 'runner_done', { exit_code: success ? 0 : 1 });
    }
  }

  if (!success) {
    process.exitCode = 1;
  }
}

export const __internal = {
  analyzeAiTouchedFiles,
  detectAiExecutionBlocker
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
