const { execFileSync } = require('node:child_process');

function resolveExecutable(command) {
  if (process.platform === 'win32') {
    return `${command}.cmd`;
  }
  return command;
}

function runCommand(label, command, args) {
  console.log(`[ztd-cli-gates] ${label}`);
  execFileSync(resolveExecutable(command), args, {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
}

function getStagedFiles() {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  });
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function runPackageScript(scriptName) {
  runCommand(`Running ${scriptName}`, 'pnpm', ['--filter', '@rawsql-ts/ztd-cli', 'run', scriptName]);
}

function runEssentialGateSuite() {
  runCommand('Running ztd-cli typecheck', 'pnpm', ['--filter', '@rawsql-ts/ztd-cli', 'exec', 'tsc', '--noEmit', '-p', 'tsconfig.json']);
  runPackageScript('test:essential');
  runPackageScript('build');
  runPackageScript('lint');
}

function main() {
  const [, , mode] = process.argv;

  if (mode === 'pre-commit') {
    getStagedFiles();
    runEssentialGateSuite();
    return;
  }

  if (mode === 'pr') {
    runEssentialGateSuite();
    return;
  }

  if (mode === 'soft') {
    runPackageScript('test:soft');
    return;
  }

  throw new Error('Expected one of: pre-commit, pr, soft');
}

if (require.main === module) {
  main();
}
