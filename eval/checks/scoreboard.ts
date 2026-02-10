import type { CheckResult } from '../lib/report';

export interface ScoreBreakdown {
  install: number;
  typecheck: number;
  test: number;
  rules: number;
  architecture: number;
  total: number;
}

function isPassed(checks: CheckResult[], name: string): boolean {
  return checks.find((item) => item.name === name)?.passed === true;
}

export function computeScoreBreakdown(
  installExit: number | null,
  typecheckExit: number | null,
  testExit: number | null,
  checks: CheckResult[]
): ScoreBreakdown {
  const install = installExit === 0 ? 30 : 0;
  const typecheck = typecheckExit === 0 ? 15 : 0;
  const test = testExit === 0 ? 15 : 0;

  const rules =
    (isPassed(checks, 'sql_composition') ? 10 : 0) +
    (isPassed(checks, 'sql_named_params') ? 5 : 0) +
    (isPassed(checks, 'sql_alias_style') ? 5 : 0);

  const architecture =
    (isPassed(checks, 'catalog_trace_quality') ? 10 : 0) +
    (isPassed(checks, 'repository_catalog_boundary') ? 10 : 0);

  return {
    install,
    typecheck,
    test,
    rules,
    architecture,
    total: install + typecheck + test + rules + architecture
  };
}
