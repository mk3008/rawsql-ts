import type { CheckResult } from '../lib/report';

const CRUD_BASIC_ALLOWED_PREFIXES = ['src/sql/', 'src/catalog/', 'src/repositories/', 'tests/'];
const LEGACY_ALLOWED_PREFIXES = ['src/ddl/', 'ztd/ddl/', 'src/sql/', 'src/catalog/', 'src/dto/', 'src/repositories/', 'tests/'];

function resolveScopeAllowlist(): readonly string[] {
  // Runner defaults scenario to "crud-basic" when not explicitly provided.
  const scenario = (process.env.EVAL_SCENARIO ?? 'crud-basic').trim();
  if (scenario === 'crud-basic') {
    return CRUD_BASIC_ALLOWED_PREFIXES;
  }
  return LEGACY_ALLOWED_PREFIXES;
}

function isAllowedPath(relativePath: string, allowlist: readonly string[]): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return allowlist.some((prefix) => normalized.startsWith(prefix));
}

export function runScopeCheck(touchedFiles: string[], aiEnabled: boolean): CheckResult {
  const allowlist = resolveScopeAllowlist();
  if (!aiEnabled) {
    return {
      name: 'scope_check',
      passed: true,
      violations: 0,
      details: ['AI step skipped'],
      meta: {
        touchedFiles: [],
        allowlist
      }
    };
  }

  const violations = touchedFiles.filter((filePath) => !isAllowedPath(filePath, allowlist));
  return {
    name: 'scope_check',
    passed: violations.length === 0,
    violations: violations.length,
    details: violations.slice(0, 50),
    meta: {
      touchedFiles,
      allowlist
    }
  };
}
