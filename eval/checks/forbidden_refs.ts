import path from 'node:path';
import { collectTextFiles, readUtf8File } from '../lib/fs';
import { normalizePathLower, normalizeTextLower } from '../lib/guards';
import type { CommandLog } from '../lib/exec';
import type { CheckResult } from '../lib/report';

export async function runForbiddenRefsCheck(
  workspacePath: string,
  repoPath: string,
  commandLogs: CommandLog[] = []
): Promise<CheckResult> {
  const files = await collectTextFiles(workspacePath);
  const violations: string[] = [];
  const normalizedRepo = normalizePathLower(repoPath);
  const repoBaseName = path.basename(repoPath).toLowerCase();

  for (const filePath of files) {
    const text = await readUtf8File(filePath);
    const lowered = normalizeTextLower(text);

    if (lowered.includes(normalizedRepo)) {
      violations.push(`${filePath}: contains absolute repo path reference`);
    }
    if (lowered.includes('../rawsql-ts') || lowered.includes('..\\rawsql-ts')) {
      violations.push(`${filePath}: contains relative library repo reference`);
    }
    if (lowered.includes('--add-dir') && lowered.includes(repoBaseName)) {
      violations.push(`${filePath}: contains --add-dir with possible library repo path`);
    }
    if (lowered.includes('writable_roots') && lowered.includes(repoBaseName)) {
      violations.push(`${filePath}: contains writable_roots with possible library repo path`);
    }
  }

  for (const commandLog of commandLogs) {
    const lowered = normalizeTextLower(
      `${commandLog.command} ${commandLog.args.join(' ')}\n${commandLog.outputHead}`
    );
    if (lowered.includes('--add-dir') && lowered.includes(repoBaseName)) {
      violations.push(`command:${commandLog.command} contains --add-dir with possible library repo path`);
    }
    if (lowered.includes('writable_roots') && lowered.includes(repoBaseName)) {
      violations.push(`command:${commandLog.command} contains writable_roots with possible library repo path`);
    }
  }

  return {
    name: 'forbidden_refs',
    passed: violations.length === 0,
    violations: violations.length,
    details: violations.slice(0, 50)
  };
}
