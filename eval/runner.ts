import path from 'node:path';
import { existsSync } from 'node:fs';
import { runForbiddenRefsCheck } from './checks/forbidden_refs';
import { runSqlRulesCheck } from './checks/sql_rules';
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

interface CliOptions {
  caseSlug: string;
  keepWorkspace: boolean;
  skipAi: boolean;
  reportPath: string;
}

const DEFAULT_CASE = 'crud-basic';
const DEFAULT_REPORT = path.join('eval', 'reports', 'latest.json');
const DEFAULT_SANDBOX_MODE = 'workspace-write';
const DEFAULT_LOCAL_DEPS = ['@rawsql-ts/shared-binder'];

interface EvalConfig {
  localDeps?: string[];
}

function parseArgs(argv: string[]): CliOptions {
  let caseSlug = DEFAULT_CASE;
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

  return { caseSlug, keepWorkspace, skipAi, reportPath };
}

async function runAndTrack(
  commandLogs: CommandLog[],
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  stdinText?: string
): Promise<void> {
  let actualCommand = command;
  let actualArgs = args;
  if (process.platform === 'win32' && (command === 'pnpm' || command === 'codex')) {
    const appData = env?.APPDATA ?? process.env.APPDATA ?? '';
    const shimCandidate = appData ? path.join(appData, 'npm', `${command}.cmd`) : `${command}.cmd`;
    const shim = existsSync(shimCandidate) ? shimCandidate : `${command}.cmd`;
    const shimQuoted = /[ \t"]/g.test(shim) ? `"${shim.replace(/"/g, '\\"')}"` : shim;
    const quotedArgs = args.map((item) => (/[ \t"]/g.test(item) ? `"${item.replace(/"/g, '\\"')}"` : item)).join(' ');
    actualCommand = 'cmd.exe';
    actualArgs = ['/d', '/s', '/c', `${shimQuoted} ${quotedArgs}`.trim()];
  }

  const result = await runCommand({ command: actualCommand, args: actualArgs, cwd, env, stdinText });
  commandLogs.push(result.log);
  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')} (exit=${result.exitCode ?? 'null'})\n${result.log.outputHead}`
    );
  }
}

async function runAndTrackAllowFailure(
  commandLogs: CommandLog[],
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  stdinText?: string
): Promise<number | null> {
  try {
    await runAndTrack(commandLogs, command, args, cwd, env, stdinText);
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
  const promptPath = path.join(repoRoot, 'eval', 'prompts', '01_crud.md');

  const commandLogs: CommandLog[] = [];
  const checks: CheckResult[] = [];
  let success = false;
  let errorMessage: string | undefined;

  assertSandboxMode(sandboxMode);
  await ensureDirectory(evalPaths.workspaceRoot);
  await ensureDirectory(path.dirname(reportPath));
  await ensureEvalCodexHome(evalPaths.codexHome);

  const codexEnv: NodeJS.ProcessEnv = {
    ...process.env,
    CODEX_HOME: evalPaths.codexHome
  };

  try {
    await ensureDirectory(workspacePath);

    // Run ztd init from source with a fixed non-interactive prompter.
    await runAndTrack(
      commandLogs,
      pnpmBin,
      ['--dir', repoRoot, 'exec', 'ts-node', ztdInitEntrypoint, workspacePath],
      repoRoot,
      codexEnv
    );

    if (!options.skipAi) {
      const promptText = await readUtf8File(promptPath);
      await runAndTrack(
        commandLogs,
        codexBin,
        [
          'exec',
          '--cd',
          workspacePath,
          '--skip-git-repo-check',
          '--sandbox',
          sandboxMode,
          '--ask-for-approval',
          'never',
          '-'
        ],
        repoRoot,
        codexEnv,
        promptText
      );
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

    const installExit = await runAndTrackAllowFailure(
      commandLogs,
      pnpmBin,
      ['--dir', workspacePath, 'install'],
      repoRoot,
      codexEnv
    );
    const typecheckExit = await runAndTrackAllowFailure(
      commandLogs,
      pnpmBin,
      ['--dir', workspacePath, 'typecheck'],
      repoRoot,
      codexEnv
    );
    const testExit = await runAndTrackAllowFailure(
      commandLogs,
      pnpmBin,
      ['--dir', workspacePath, 'test'],
      repoRoot,
      codexEnv
    );

    checks.push(await runForbiddenRefsCheck(workspacePath, repoRoot, commandLogs));
    checks.push(await runSqlRulesCheck(workspacePath));
    success = checks.every((item) => item.passed) && installExit === 0 && typecheckExit === 0 && testExit === 0;
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
      if (checks.some((item) => !item.passed)) {
        failures.push('check failures detected');
      }
      errorMessage = failures.join('; ');
    }
  } catch (error) {
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
      score_total: success ? computeScore(checks) : 0,
      success,
      error: errorMessage
    };

    await writeReport(reportPath, report);
    if (!options.keepWorkspace) {
      await removeDirectoryRecursive(workspacePath);
    }
  }

  if (!success) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
