import type { CheckResult } from '../lib/report';

const ALLOWED_PREFIXES = [
  'src/ddl/',
  'ztd/ddl/',
  'src/sql/',
  'src/catalog/',
  'src/dto/',
  'src/repositories/',
  'src/types/',
  'tests/',
  'vitest.config.ts',
  'pnpm-lock.yaml'
];

function isAllowedPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function runScopeCheck(touchedFiles: string[], aiEnabled: boolean): CheckResult {
  if (!aiEnabled) {
    return {
      name: 'scope_check',
      passed: true,
      violations: 0,
      details: ['AI step skipped'],
      meta: {
        touchedFiles: [],
        allowlist: ALLOWED_PREFIXES
      }
    };
  }

  const violations = touchedFiles.filter((filePath) => !isAllowedPath(filePath));
  return {
    name: 'scope_check',
    passed: violations.length === 0,
    violations: violations.length,
    details: violations.slice(0, 50),
    meta: {
      touchedFiles,
      allowlist: ALLOWED_PREFIXES
    }
  };
}
