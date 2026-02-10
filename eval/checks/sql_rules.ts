import { collectTextFiles, readUtf8File } from '../lib/fs';
import type { CheckResult } from '../lib/report';

interface SqlRulesResult {
  combined: CheckResult;
  namedParams: CheckResult;
  aliasStyle: CheckResult;
}

export async function runSqlRulesChecks(workspacePath: string): Promise<SqlRulesResult> {
  const files = await collectTextFiles(workspacePath);
  const namedParamViolations: string[] = [];
  const aliasViolations: string[] = [];

  const sqlFiles = files.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('/src/sql/') && normalized.endsWith('.sql');
  });

  for (const filePath of sqlFiles) {
    const sql = await readUtf8File(filePath);
    if (/\$\d+\b/.test(sql)) {
      namedParamViolations.push(`${filePath}: positional parameter ($1 style) is forbidden`);
    }
    if (/\bas\s+"[a-z]+[a-z0-9]*[A-Z][A-Za-z0-9]*"/.test(sql)) {
      aliasViolations.push(`${filePath}: quoted camelCase alias is forbidden`);
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

  const violations = [...namedParamViolations, ...aliasViolations];
  const details = [...violations];
  if (!hasQueryIdStyle) {
    details.push(
      'TODO: query_id/specId check is currently informational only because template-level query identity rule is not yet fixed.'
    );
  }

  return {
    combined: {
      name: 'sql_rules',
      passed: violations.length === 0,
      violations: violations.length,
      details: details.slice(0, 50)
    },
    namedParams: {
      name: 'sql_named_params',
      passed: namedParamViolations.length === 0,
      violations: namedParamViolations.length,
      details: namedParamViolations.slice(0, 50)
    },
    aliasStyle: {
      name: 'sql_alias_style',
      passed: aliasViolations.length === 0,
      violations: aliasViolations.length,
      details: aliasViolations.slice(0, 50)
    }
  };
}
