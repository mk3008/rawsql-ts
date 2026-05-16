import { spawnSync } from 'node:child_process';

const generatedPaths = [
  'docs/transfer-docs.md',
  'docs/scope',
  'docs/review.md',
  'docs/concepts',
  'docs/dfd',
  'docs/processes',
  'docs/roles',
  'docs/rawsql-transfer',
];

const diffResult = spawnSync('git', ['diff', '--exit-code', '--', ...generatedPaths], {
  encoding: 'utf8',
  stdio: 'inherit',
});

if (diffResult.error) {
  console.error(diffResult.error.message);
  process.exit(1);
}

const untrackedResult = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '--', ...generatedPaths], {
  encoding: 'utf8',
});

if (untrackedResult.error) {
  console.error(untrackedResult.error.message);
  process.exit(1);
}

if (untrackedResult.status !== 0) {
  process.exit(1);
}

const untrackedFiles = untrackedResult.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

if (untrackedFiles.length > 0) {
  console.error('Generated transfer docs include untracked files:');
  for (const file of untrackedFiles) {
    console.error(`- ${file}`);
  }
}

if (diffResult.status !== 0 || untrackedFiles.length > 0) {
  process.exit(1);
}
