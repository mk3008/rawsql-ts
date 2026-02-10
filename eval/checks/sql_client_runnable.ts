import { collectTextFiles, readUtf8File } from '../lib/fs';
import type { CheckResult } from '../lib/report';

const FORBIDDEN_SQL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\{\{[\s\S]*?\}\}/, reason: 'Handlebars-style template markers are forbidden.' },
  { pattern: /\$\{[\s\S]*?\}/, reason: 'JavaScript template placeholders are forbidden in SQL assets.' },
  { pattern: /<%[\s\S]*?%>/, reason: 'EJS-style template markers are forbidden.' },
  { pattern: /\/\*\s*@if[\s\S]*?\*\//i, reason: 'Directive-style conditional syntax is forbidden.' }
];

export async function runSqlClientRunnableCheck(workspacePath: string): Promise<CheckResult> {
  const files = await collectTextFiles(workspacePath);
  const violations: string[] = [];

  const sqlFiles = files.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('/src/sql/') && normalized.endsWith('.sql');
  });

  for (const filePath of sqlFiles) {
    const sql = await readUtf8File(filePath);
    for (const item of FORBIDDEN_SQL_PATTERNS) {
      if (item.pattern.test(sql)) {
        violations.push(`${filePath}: ${item.reason}`);
      }
    }
  }

  return {
    name: 'sql_client_runnable',
    passed: violations.length === 0,
    violations: violations.length,
    details: violations.slice(0, 50)
  };
}
