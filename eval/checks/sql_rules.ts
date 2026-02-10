import path from 'node:path';
import { collectTextFiles, readUtf8File } from '../lib/fs';
import type { CheckResult } from '../lib/report';

export async function runSqlRulesCheck(workspacePath: string): Promise<CheckResult> {
  const files = await collectTextFiles(workspacePath);
  const violations: string[] = [];

  const sqlFiles = files.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('/src/sql/') && normalized.endsWith('.sql');
  });

  for (const filePath of sqlFiles) {
    const sql = await readUtf8File(filePath);
    if (/\$\d+\b/.test(sql)) {
      violations.push(`${filePath}: positional parameter ($1 style) is forbidden`);
    }
    if (/\bas\s+"[a-z]+[a-z0-9]*[A-Z][A-Za-z0-9]*"/.test(sql)) {
      violations.push(`${filePath}: quoted camelCase alias is forbidden`);
    }
  }

  const catalogFiles = files.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('/src/catalog/') && normalized.endsWith('.ts');
  });
  let hasQueryIdStyle = false;
  for (const filePath of catalogFiles) {
    const ts = await readUtf8File(filePath);
    if (/\b(id|specId)\s*:/.test(ts) || /query_id/.test(ts)) {
      hasQueryIdStyle = true;
      break;
    }
  }

  const details = [...violations];
  if (!hasQueryIdStyle) {
    details.push(
      'TODO: query_id/specId check is currently informational only because template-level query identity rule is not yet fixed.'
    );
  }

  return {
    name: 'sql_rules',
    passed: violations.length === 0,
    violations: violations.length,
    details: details.slice(0, 50)
  };
}
