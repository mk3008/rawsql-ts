import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const sqlFiles = collectSqlFiles([
  path.join(rootDir, 'db'),
  path.join(rootDir, 'src')
]);

const violations = [];

for (const filePath of sqlFiles) {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.trimEnd().endsWith(',')) {
      violations.push(`${toProjectPath(filePath)}:${index + 1}: use leading commas in multiline SQL lists`);
    }
  });
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exit(1);
}

function collectSqlFiles(directories) {
  const results = [];
  for (const directory of directories) {
    visit(directory, results);
  }
  return results.sort();
}

function visit(directory, results) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(entryPath, results);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.sql')) {
      results.push(entryPath);
    }
  }
}

function toProjectPath(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}
