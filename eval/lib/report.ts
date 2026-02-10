import path from 'node:path';
import { ensureDirectory, writeUtf8File } from './fs';
import type { CommandLog } from './exec';
import { computeScoreBreakdown, type ScoreBreakdown } from '../checks/scoreboard';

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
  score_breakdown: ScoreBreakdown;
  score_total: number;
  success: boolean;
  error?: string;
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
  return computeScoreBreakdown(installExit, typecheckExit, testExit, checks);
}
