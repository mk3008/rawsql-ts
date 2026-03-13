const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function matchesExtension(filePath) {
  return /\.(?:[cm]?[jt]sx?|json)$/iu.test(filePath);
}

function isTestFile(filePath) {
  return /(?:^|\/)(?:tests?|__tests__)\/.*\.(?:test|spec)\.[cm]?[jt]sx?$/iu.test(filePath);
}

function isQuerySpecFile(filePath) {
  return filePath.includes('/src/catalog/specs/') && matchesExtension(filePath);
}

function isRepositorySourceFile(filePath) {
  return (
    filePath.includes('/src/repositories/')
    && /\.(?:[cm]?[jt]sx?)$/iu.test(filePath)
    && !filePath.endsWith('.d.ts')
  );
}

function isPerfSensitiveSourceFile(filePath) {
  return (
    filePath.includes('benchmarks/')
    || filePath.includes('/src/perf/')
    || filePath.includes('docs/guide/ztd-benchmarking')
  );
}

function isPerfEvidenceFile(filePath) {
  return (
    /(?:perf|benchmark|dogfood)/iu.test(filePath)
    && (
      isTestFile(filePath)
      || filePath.includes('docs/dogfooding/')
      || filePath.includes('docs/bench/')
      || filePath.includes('benchmarks/')
    )
  );
}

function fileContainsTelemetryHook(filePath, readFile = defaultReadFile) {
  const contents = readFile(filePath);
  return /(resolveRepositoryTelemetry|RepositoryTelemetry|repositoryTelemetry)/u.test(contents);
}

function defaultReadFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function collectPolicyViolations(stagedFiles, options = {}) {
  const readFile = options.readFile || defaultReadFile;
  const normalizedFiles = stagedFiles.map(normalizePath);
  const violations = [];

  const querySpecFiles = normalizedFiles.filter(isQuerySpecFile);
  const repositoryFiles = normalizedFiles.filter(isRepositorySourceFile);
  const perfSensitiveFiles = normalizedFiles.filter(isPerfSensitiveSourceFile);
  const stagedTestFiles = normalizedFiles.filter(isTestFile);
  const perfEvidenceFiles = normalizedFiles.filter(isPerfEvidenceFile);

  // QuerySpec additions or edits must travel with executable tests in the same commit.
  if (querySpecFiles.length > 0 && stagedTestFiles.length === 0) {
    violations.push([
      'QuerySpec changes require tests in the same commit.',
      `Changed QuerySpec files: ${querySpecFiles.join(', ')}`,
      'Expected at least one staged test file under tests/**/*.test.ts.',
    ].join(' '));
  }

  // Repository source changes should wire the telemetry seam instead of relying on memory.
  const repositoryFilesMissingTelemetry = repositoryFiles.filter(
    (filePath) => !fileContainsTelemetryHook(filePath, readFile),
  );
  if (repositoryFilesMissingTelemetry.length > 0) {
    violations.push([
      'Repository source changes must include a telemetry hook seam.',
      `Files missing repository telemetry markers: ${repositoryFilesMissingTelemetry.join(', ')}`,
      'Expected resolveRepositoryTelemetry(...) or RepositoryTelemetry references.',
    ].join(' '));
  }

  // Perf-sensitive implementation changes must carry a visible perf regression surface.
  if (perfSensitiveFiles.length > 0 && perfEvidenceFiles.length === 0) {
    violations.push([
      'Perf-sensitive changes require perf evidence in the same commit.',
      `Changed perf-sensitive files: ${perfSensitiveFiles.join(', ')}`,
      'Stage a perf test, benchmark update, or dogfooding document alongside the change.',
    ].join(' '));
  }

  return violations;
}

function getStagedFiles(cwd = process.cwd()) {
  const output = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
    { cwd, encoding: 'utf8' },
  );

  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function main() {
  const stagedFiles = getStagedFiles();
  const violations = collectPolicyViolations(stagedFiles);

  if (violations.length === 0) {
    return;
  }

  console.error('[pre-commit] Policy enforcement failed.');
  for (const violation of violations) {
    console.error(`[pre-commit] ${violation}`);
  }
  process.exit(1);
}

module.exports = {
  collectPolicyViolations,
  fileContainsTelemetryHook,
  getStagedFiles,
  isPerfEvidenceFile,
  isPerfSensitiveSourceFile,
  isQuerySpecFile,
  isRepositorySourceFile,
  isTestFile,
  main,
  normalizePath,
};

if (require.main === module) {
  main();
}
