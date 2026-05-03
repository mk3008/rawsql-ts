import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const benchmarkRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(benchmarkRoot, '..', '..');
const officialRepo = 'https://github.com/drizzle-team/drizzle-benchmarks.git';
const officialCommit = '2ae27415a69f00b4f0f734ebb0a98e7799008819';
const targetDir = path.resolve(repoRoot, 'tmp', 'drizzle-benchmarks-rawsql');

const run = (command, args, options = {}) => {
  execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
};

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  run('git', ['clone', officialRepo, targetDir]);
}

run('git', ['fetch', '--depth', '1', 'origin', officialCommit], { cwd: targetDir });
run('git', ['checkout', '--force', officialCommit], { cwd: targetDir });

for (const relativePath of ['src/rfba', 'src/local', 'profiles', 'sql']) {
  fs.rmSync(path.join(targetDir, relativePath), { force: true, recursive: true });
}

fs.cpSync(path.join(benchmarkRoot, 'src'), path.join(targetDir, 'src'), { recursive: true });
fs.cpSync(path.join(benchmarkRoot, 'sql'), path.join(targetDir, 'sql'), { recursive: true });
fs.cpSync(path.join(benchmarkRoot, 'profiles'), path.join(targetDir, 'profiles'), { recursive: true });
fs.cpSync(path.join(benchmarkRoot, 'bench', 'bench.js'), path.join(targetDir, 'bench', 'bench.js'));
fs.cpSync(path.join(benchmarkRoot, 'scripts', 'run-k6-docker.mjs'), path.join(targetDir, 'scripts', 'run-k6-docker.mjs'));
fs.cpSync(
  path.join(benchmarkRoot, 'scripts', 'run-rotated-k6-suite.mjs'),
  path.join(targetDir, 'scripts', 'run-rotated-k6-suite.mjs')
);

const initialMigrationPath = path.join(targetDir, 'drizzle', '20230813113328_flat_master_mold', 'migration.sql');
const initialMigration = fs.readFileSync(initialMigrationPath, 'utf8');
fs.writeFileSync(initialMigrationPath, initialMigration.replaceAll('"qt_per_unit"', '"quantity_per_unit"'));

const generatePath = path.join(targetDir, 'src', 'generate.ts');
const generateSource = fs.readFileSync(generatePath, 'utf8');
fs.writeFileSync(
  generatePath,
  generateSource.replace('const db = drizzle(client, { logger: false });', 'const db = drizzle({ client, logger: false });')
);

const packageJsonPath = path.join(targetDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.scripts = {
  ...packageJson.scripts,
  'start:handwritten': 'tsx ./src/handwritten-server-node.ts',
  'start:rawsql': 'tsx ./src/rawsql-server-node.ts',
  'start:rawsql:rfba': 'tsx ./src/rawsql-rfba-server-node.ts',
  'start:rawsql:validation': 'tsx ./src/rawsql-server-node-validation.ts',
  'bench:k6:docker': 'node ./scripts/run-k6-docker.mjs',
  'bench:k6:docker:smoke': 'node ./scripts/run-k6-docker.mjs --name smoke --vus 1 --iterations 5',
  'bench:k6:docker:rotated': 'node ./scripts/run-rotated-k6-suite.mjs',
};
fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log(`Materialized Drizzle benchmark with rawsql-ts overlay at ${targetDir}`);
