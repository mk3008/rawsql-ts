import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const ignoredSegments = new Set(['node_modules', '.git', 'dist', 'tmp']);

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
  console.log('[generated-mapper-drift] no scaffold generated row mappers found; skipping');
  process.exit(0);
}

for (const featureRoot of featureRoots) {
  const featureName = path.basename(featureRoot);
  const cwd = findProjectRoot(featureRoot);
  if (!cwd) {
    console.log(`[generated-mapper-drift] skipping ${path.relative(repoRoot, featureRoot)}; no package.json ztd script found`);
    continue;
  }
  console.log(`[generated-mapper-drift] checking ${path.relative(repoRoot, featureRoot)}`);
  execFileSync('pnpm', ['ztd', 'feature', 'generated-mapper', 'check', '--feature', featureName], {
    cwd,
    stdio: 'inherit',
  });
}
