import { collectTextFiles, readUtf8File } from '../lib/fs';
import type { CheckResult } from '../lib/report';

interface ContractDriftChecks {
  contractDrift: CheckResult;
  repositoryBoundary: CheckResult;
}

function extractNamedSqlParams(sql: string): Set<string> {
  const params = new Set<string>();
  const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  for (const match of sql.matchAll(regex)) {
    params.add(match[1]);
  }
  return params;
}

export async function runContractDriftChecks(workspacePath: string): Promise<ContractDriftChecks> {
  const files = await collectTextFiles(workspacePath);
  const sqlFiles = files.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('/src/sql/') && normalized.endsWith('.sql');
  });
  const repositoryFiles = files.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('/src/repositories/') && normalized.endsWith('.ts');
  });

  const sqlParams = new Set<string>();
  for (const filePath of sqlFiles) {
    const sql = await readUtf8File(filePath);
    for (const param of extractNamedSqlParams(sql)) {
      sqlParams.add(param);
    }
  }

  const contractViolations: string[] = [];
  const boundaryViolations: string[] = [];
  for (const filePath of repositoryFiles) {
    const source = await readUtf8File(filePath);

    // Repositories should call catalog/runtime instead of embedding raw SQL.
    const hasInlineSqlLiteral =
      /`[\s\S]{0,300}\b(select|insert|update|delete)\b[\s\S]{0,300}`/i.test(source) ||
      /(['"])\s*(select|insert|update|delete)\b[\s\S]{0,300}\1/i.test(source);
    if (hasInlineSqlLiteral) {
      boundaryViolations.push(`${filePath}: repository contains inline SQL literal.`);
    }

    // Validate that repository param dereferences map to known named SQL params.
    for (const match of source.matchAll(/\b(?:params|input)\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
      const paramName = match[1];
      if (!sqlParams.has(paramName)) {
        contractViolations.push(
          `${filePath}: repository references "${paramName}" but no matching named SQL parameter was observed.`
        );
      }
    }
  }

  if (sqlParams.size === 0) {
    contractViolations.push('Not observed: named SQL parameters in src/sql assets.');
  }

  return {
    contractDrift: {
      name: 'contract_drift',
      passed: contractViolations.length === 0,
      violations: contractViolations.length,
      details: contractViolations.slice(0, 50),
      meta: {
        sqlParamCount: sqlParams.size
      }
    },
    repositoryBoundary: {
      name: 'repository_catalog_boundary',
      passed: boundaryViolations.length === 0,
      violations: boundaryViolations.length,
      details: boundaryViolations.slice(0, 50)
    }
  };
}
