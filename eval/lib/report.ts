import path from 'node:path';
import { ensureDirectory, writeUtf8File } from './fs';
import type { CommandLog } from './exec';

export interface CheckResult {
  name: string;
  passed: boolean;
  violations: number;
  details: string[];
  meta?: Record<string, unknown>;
}

export interface EvalReport {
  caseSlug: string;
  workspace_path: string;
  cwd_used: string;
  codex_home: string;
  sandbox_mode: string;
  started_at: string;
  finished_at: string;
  commands: CommandLog[];
  checks: CheckResult[];
  codex_home_bootstrap?: {
    copied_paths: string[];
    skipped_paths: string[];
    reason: string;
  };
  meta?: {
    test_command?: string;
    test_excludes?: string[];
    test_mode?: 'eval' | 'full';
    test_fallback_policy?: 'fail_fast_no_fallback' | 'fallback_to_full';
    test_fallback_attempted?: boolean;
    test_fallback_reason?: string;
  };
  score_breakdown: ScoreBreakdown;
  score_total: number;
  success: boolean;
  error?: string;
}

export interface ScoreBreakdown {
  install: number;
  typecheck: number;
  test: number;
  checks: number;
  total: number;
}

export async function writeReport(reportPath: string, report: EvalReport): Promise<void> {
  const absolute = path.resolve(reportPath);
  await ensureDirectory(path.dirname(absolute));
  await writeUtf8File(absolute, `${JSON.stringify(report, null, 2)}\n`);
}

export function computeScore(
  installExit: number | null,
  typecheckExit: number | null,
  testExit: number | null,
  checks: CheckResult[]
): ScoreBreakdown {
  const install = installExit === 0 ? 30 : 0;
  const typecheck = typecheckExit === 0 ? 30 : 0;
  const test = testExit === 0 ? 30 : 0;

  const scoredChecks = ['sql_rules', 'forbidden_refs', 'scope_check', 'trace_presence'];
  const passedChecks = scoredChecks.filter((name) => checks.find((item) => item.name === name)?.passed === true).length;
  const checksScore = (passedChecks / scoredChecks.length) * 10;
  const total = install + typecheck + test + checksScore;

  return {
    install,
    typecheck,
    test,
    checks: checksScore,
    total
  };
}
