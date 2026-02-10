import { collectTextFiles, readUtf8File } from '../lib/fs';
import type { CheckResult } from '../lib/report';

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/i;

export async function runSqlCompositionCheck(workspacePath: string): Promise<CheckResult> {
  const files = await collectTextFiles(workspacePath);
  const violations: string[] = [];

  const sourceFiles = files.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return normalized.startsWith(`${workspacePath.replace(/\\/g, '/').toLowerCase()}/src/`) && SOURCE_EXTENSIONS.test(filePath);
  });

  for (const filePath of sourceFiles) {
    const source = await readUtf8File(filePath);
    const hasTemplateInterpolation =
      /(?:sql|query|statement)[^=\n]*=\s*`[\s\S]*?\$\{[\s\S]*?\}[\s\S]*?`/i.test(source) &&
      /\b(select|insert|update|delete)\b/i.test(source);
    const hasStringConcat =
      /(["'`])\s*(select|insert|update|delete)\b[\s\S]{0,160}?\1\s*\+\s*[\w("'`]/i.test(source) ||
      /\b(sql|query|statement)\b[\s\S]{0,160}?\+\s*["'`]/i.test(source);
    if (hasTemplateInterpolation || hasStringConcat) {
      violations.push(`${filePath}: SQL string composition detected in source code.`);
    }
  }

  return {
    name: 'sql_composition',
    passed: violations.length === 0,
    violations: violations.length,
    details: violations.slice(0, 50)
  };
}
