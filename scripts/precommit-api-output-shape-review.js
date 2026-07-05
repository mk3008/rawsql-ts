const { execFileSync } = require('node:child_process');

const MAX_BUFFER = 50 * 1024 * 1024;
const SKILL_PATH = '.agents/skills/api-output-shape-review/SKILL.md';

const STRONG_SQL_OUTPUT_PATTERNS = [
  ['sql: string', /\bsql\??:\s*string\b/u],
  ['formattedSql', /\bformattedSql\b/u],
  ['formatSqlComponent(', /\bformatSqlComponent\s*\(/u],
  ['new SqlFormatter', /\bnew\s+SqlFormatter\b/u],
  ['SelectQueryParser.parse(', /\bSelectQueryParser\.parse\s*\(/u],
];

const API_SURFACE_PATTERNS = [
  ['export interface *Result', /\bexport\s+interface\s+\w*Result\b/u],
  ['export type *Result', /\bexport\s+type\s+\w*Result\b/u],
  ['export const', /\bexport\s+const\s+\w+\s*=/u],
  ['export function', /\bexport\s+function\b/u],
  ['public method', /\bpublic\s+[^;\n]*\(/u],
];

const TRANSFORM_CONTEXT_PATTERNS = [
  ['string | SelectQuery', /\bstring\s*\|\s*SelectQuery\b/u],
  ['string | *Query', /\bstring\s*\|\s*\w*Query\b/u],
  ['optimize', /\boptimize\w*\b/iu],
  ['transform', /\btransform\w*\b/iu],
  ['format', /\bformat\w*\b/iu],
  ['parse', /\bparse\w*\b/iu],
];

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function isTypeScriptSourceFile(filePath) {
  return /\.ts$/iu.test(filePath) && !/\.d\.ts$/iu.test(filePath);
}

function isTestFile(filePath) {
  return /(?:^|\/)(?:tests?|__tests__)\/.*\.(?:test|spec)\.[cm]?[jt]sx?$/iu.test(filePath)
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/iu.test(filePath);
}

function isDocsApiFile(filePath) {
  return /^docs\/api\/.*\.md$/iu.test(filePath);
}

function isSkillFile(filePath) {
  return normalizePath(filePath) === SKILL_PATH;
}

function isTransformerFile(filePath) {
  return /^packages\/core\/src\/transformers\/.*\.ts$/iu.test(filePath);
}

function isPublicIndexFile(filePath) {
  return /^packages\/.*\/src\/index\.ts$/iu.test(filePath);
}

function isPackageSourceCandidate(filePath) {
  const normalizedPath = normalizePath(filePath);

  if (!isTypeScriptSourceFile(normalizedPath) || isTestFile(normalizedPath)) {
    return false;
  }

  return /^packages\/core\/src\/.*\.ts$/iu.test(normalizedPath)
    || /^packages\/[^/]+\/src\/.*\.ts$/iu.test(normalizedPath)
    || isPublicIndexFile(normalizedPath);
}

function findPatternNames(text, patterns) {
  return patterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

function containsReviewNote(text) {
  return /api-output-shape-review/iu.test(text)
    || /\bapi output shape review\s*:/iu.test(text)
    || /\bapi output shape reviewed\s*:/iu.test(text);
}

function containsAnyReviewSignal(text) {
  return findPatternNames(text, [
    ...STRONG_SQL_OUTPUT_PATTERNS,
    ...API_SURFACE_PATTERNS,
    ...TRANSFORM_CONTEXT_PATTERNS,
  ]).length > 0;
}

function classifyCandidate(filePath, diffText, stagedContent) {
  const diffMatches = findPatternNames(diffText, STRONG_SQL_OUTPUT_PATTERNS);
  const apiMatches = findPatternNames(diffText, API_SURFACE_PATTERNS);
  const contextMatches = findPatternNames(`${diffText}\n${stagedContent}`, TRANSFORM_CONTEXT_PATTERNS);
  const contentSqlMatches = findPatternNames(stagedContent, STRONG_SQL_OUTPUT_PATTERNS);
  const hasResultTypeChange = /\bexport\s+(?:interface|type)\s+\w*Result\b/u.test(diffText);
  const hasSqlStringInChangedOrStagedText = /\bsql\??:\s*string\b/u.test(`${diffText}\n${stagedContent}`);
  const reasons = [];

  if (diffMatches.length > 0) {
    reasons.push(`changed SQL string or formatter surface (${diffMatches.join(', ')})`);
  }

  if (hasResultTypeChange && hasSqlStringInChangedOrStagedText) {
    reasons.push('changed exported Result type with sql string output');
  }

  if (
    isTransformerFile(filePath)
    && apiMatches.length > 0
    && (contextMatches.length > 0 || diffMatches.length > 0 || contentSqlMatches.length > 0)
  ) {
    reasons.push(`changed exported transformer API surface (${apiMatches.join(', ')})`);
  }

  if (
    isPublicIndexFile(filePath)
    && apiMatches.length > 0
    && (hasResultTypeChange || diffMatches.length > 0 || contextMatches.includes('string | *Query'))
  ) {
    reasons.push(`changed public package API surface (${apiMatches.join(', ')})`);
  }

  if (reasons.length === 0) {
    return null;
  }

  return {
    filePath,
    reasons: [...new Set(reasons)],
  };
}

function collectApiOutputShapeReviewFindings(stagedFiles, options = {}) {
  const normalizedFiles = stagedFiles.map(normalizePath);
  const getDiffForFile = options.getDiffForFile || (() => '');
  const readStagedFileContent = options.readStagedFileContent || (() => '');
  const allDiff = options.allDiff !== undefined
    ? options.allDiff
    : normalizedFiles.map((filePath) => getDiffForFile(filePath)).join('\n');
  const skillChanged = normalizedFiles.some(isSkillFile);
  const reviewNoteFound = containsReviewNote(allDiff);
  const candidates = [];
  const warnings = [];

  for (const filePath of normalizedFiles) {
    const diffText = getDiffForFile(filePath);

    if (isDocsApiFile(filePath)) {
      if (containsAnyReviewSignal(diffText)) {
        warnings.push({
          filePath,
          message: 'docs/api generated API documentation changed; review manually if this is not generated output.',
        });
      }
      continue;
    }

    if (!isPackageSourceCandidate(filePath)) {
      continue;
    }

    const candidate = classifyCandidate(
      filePath,
      diffText,
      readStagedFileContent(filePath),
    );

    if (candidate) {
      candidates.push(candidate);
    }
  }

  const allowedByReviewMarker = skillChanged || reviewNoteFound;
  const blockedFiles = allowedByReviewMarker ? [] : candidates;

  return {
    ok: blockedFiles.length === 0,
    allowedByReviewMarker,
    blockedFiles,
    candidates,
    reviewNoteFound,
    skillChanged,
    warnings,
  };
}

function runGit(args, cwd = process.cwd()) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
  });
}

function getStagedFiles(cwd = process.cwd()) {
  return runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], cwd)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function getStagedDiff(cwd = process.cwd()) {
  return runGit(['diff', '--cached', '--unified=0', '--no-ext-diff'], cwd);
}

function getStagedDiffForFile(filePath, cwd = process.cwd()) {
  return runGit(['diff', '--cached', '--unified=0', '--no-ext-diff', '--', normalizePath(filePath)], cwd);
}

function readStagedFileContent(filePath, cwd = process.cwd()) {
  try {
    return runGit(['show', `:${normalizePath(filePath)}`], cwd);
  } catch (_error) {
    return '';
  }
}

function formatFailureMessage(findings) {
  const lines = [
    '[api-output-shape-review] Potential public SQL/AST transformation API change detected.',
    '',
    'This change appears to add or modify an API that returns SQL strings, formats SQL, or exposes a SQL-bearing Result shape.',
    'Before committing, review it with:',
    `  ${SKILL_PATH}`,
    '',
    'Add a short review note to the staged diff, for example:',
    '  API output shape review: kept result.sql for compatibility and added result.query for downstream AST processing.',
    '',
    'Files:',
  ];

  for (const candidate of findings.blockedFiles) {
    lines.push(`  - ${candidate.filePath}`);
    for (const reason of candidate.reasons) {
      lines.push(`    reason: ${reason}`);
    }
  }

  return lines.join('\n');
}

function main() {
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    return;
  }

  const findings = collectApiOutputShapeReviewFindings(stagedFiles, {
    allDiff: getStagedDiff(),
    getDiffForFile: getStagedDiffForFile,
    readStagedFileContent,
  });

  for (const warning of findings.warnings) {
    console.warn(`[api-output-shape-review] Warning: ${warning.message} File: ${warning.filePath}`);
  }

  if (findings.ok) {
    return;
  }

  console.error(formatFailureMessage(findings));
  process.exit(1);
}

module.exports = {
  SKILL_PATH,
  classifyCandidate,
  collectApiOutputShapeReviewFindings,
  containsReviewNote,
  formatFailureMessage,
  getStagedDiff,
  getStagedDiffForFile,
  getStagedFiles,
  isDocsApiFile,
  isPackageSourceCandidate,
  isPublicIndexFile,
  isSkillFile,
  isTestFile,
  isTransformerFile,
  normalizePath,
  readStagedFileContent,
};

if (require.main === module) {
  main();
}
