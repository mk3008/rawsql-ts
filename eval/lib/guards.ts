import os from 'node:os';
import path from 'node:path';

export interface EvalPaths {
  workspaceRoot: string;
  codexHome: string;
}

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function timestampLabel(date: Date): string {
  const yyyy = date.getFullYear().toString().padStart(4, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const mi = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

export function resolveEvalPaths(env: NodeJS.ProcessEnv): EvalPaths {
  const home = os.homedir();
  const defaultWorkspaceRoot = process.platform === 'win32'
    ? path.join(home, '_ztd_eval', 'workspaces')
    : path.join(home, '_ztd_eval', 'workspaces');

  const workspaceRoot = env.EVAL_WORKSPACE_ROOT ? path.resolve(env.EVAL_WORKSPACE_ROOT) : defaultWorkspaceRoot;
  const codexHome = env.EVAL_CODEX_HOME
    ? path.resolve(env.EVAL_CODEX_HOME)
    : path.join(workspaceRoot, '_codex_home');

  return { workspaceRoot, codexHome };
}

export function buildCaseWorkspaceName(caseSlug: string, now = new Date()): string {
  const normalized = sanitizeSlug(caseSlug) || 'crud-basic';
  return `case-${timestampLabel(now)}-${normalized}`;
}

export function assertSandboxMode(mode: string): void {
  if (mode === 'danger-full-access') {
    throw new Error('danger-full-access is forbidden in eval harness');
  }
}

export function normalizePathLower(inputPath: string): string {
  return path.normalize(inputPath).replace(/\\/g, '/').toLowerCase();
}

export function normalizeTextLower(value: string): string {
  return value.replace(/\r\n/g, '\n').toLowerCase();
}
