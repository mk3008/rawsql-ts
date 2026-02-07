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
  score_total: number;
  success: boolean;
  error?: string;
}

export async function writeReport(reportPath: string, report: EvalReport): Promise<void> {
  const absolute = path.resolve(reportPath);
  await ensureDirectory(path.dirname(absolute));
  await writeUtf8File(absolute, `${JSON.stringify(report, null, 2)}\n`);
}

export function computeScore(checks: CheckResult[]): number {
  if (checks.length === 0) {
    return 100;
  }
  return checks.every((item) => item.passed) ? 100 : 0;
}
