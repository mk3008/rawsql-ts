import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.env.GENERATED_MAPPER_DRIFT_ROOT ?? path.resolve(__dirname, '..'));
const ignoredSegments = new Set(['node_modules', '.git', 'dist', 'tmp']);
const packageManagerExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function walk(dir, matches = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredSegments.has(entry.name)) {
      continue;
    }
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, matches);
      continue;
    }
    if (entry.isFile() && entry.name === 'row-mapper.ts' && absolute.includes(`${path.sep}generated${path.sep}`)) {
      matches.push(absolute);
    }
  }
  return matches;
}

function featureRootForGeneratedMapper(filePath) {
  const parts = filePath.split(path.sep);
  const generatedIndex = parts.lastIndexOf('generated');
  if (generatedIndex < 3 || parts[generatedIndex - 2] !== 'queries') {
    return null;
  }
  return parts.slice(0, generatedIndex - 2).join(path.sep);
}

function findProjectRoot(startDir) {
  let current = startDir;
  while (current.startsWith(repoRoot)) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.scripts?.ztd) {
        return current;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

const featureRoots = [...new Set(walk(repoRoot).map(featureRootForGeneratedMapper).filter(Boolean))].sort();

if (featureRoots.length === 0) {
  console.log('[generated-mapper-drift] no scaffold generated row mappers found; skipping because this root has no RFBA scaffold generated mapper artifacts');
  process.exit(0);
}

for (const featureRoot of featureRoots) {
  const featureName = path.basename(featureRoot);
  const cwd = findProjectRoot(featureRoot);
  if (!cwd) {
    console.error(
      [
        `[generated-mapper-drift] cannot check ${path.relative(repoRoot, featureRoot)}; no parent package.json with a ztd script was found.`,
        'Generated row mappers are machine-owned and must be passively checked in CI/test.',
        `Add a package-level ztd script or run \`ztd feature generated-mapper check --feature ${featureName}\` from the owning project.`,
      ].join('\n')
    );
    process.exitCode = 1;
    continue;
  }
  console.log(`[generated-mapper-drift] checking ${path.relative(repoRoot, featureRoot)}`);
  execFileSync(packageManagerExecutable, ['ztd', 'feature', 'generated-mapper', 'check', '--feature', featureName], {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

if (process.exitCode) {
  process.exit();
}
