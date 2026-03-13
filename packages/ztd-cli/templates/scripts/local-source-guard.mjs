import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const command = process.argv[2];

if (command !== 'test' && command !== 'typecheck' && command !== 'ztd') {
  console.error('local-source guard expects "test", "typecheck", or "ztd".');
  process.exit(1);
}

if (command === 'ztd') {
  const cliEntry = path.resolve(projectRoot, '__LOCAL_SOURCE_ZTD_CLI__');
  const requestedSubcommand = process.argv.slice(3).join(' ').trim() || '(none)';
  if (!existsSync(cliEntry)) {
    console.error(
      [
        '[local-source guard] ztd cannot run against the local source checkout yet.',
        '',
        `What happened:`,
        `- Requested subcommand: ${requestedSubcommand}`,
        `- Project root: ${normalizePath(projectRoot)}`,
        `- The local CLI entry was not found at ${normalizePath(cliEntry)}.`,
        '',
        'Next steps:',
        '1. Build the local CLI package (for example: pnpm --filter @rawsql-ts/ztd-cli build)',
        '2. Confirm this scaffold still points at the intended rawsql-ts monorepo root',
        '3. Re-run pnpm ztd <subcommand>'
      ].join('\n')
    );
    process.exit(1);
  }

  const cliArgs = process.argv.slice(3);
  const result = spawnSync(process.execPath, [cliEntry, ...cliArgs], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false
  });
  process.exit(result.status ?? 1);
}

const workspaceRoot = findAncestorPnpmWorkspaceRoot(projectRoot);
const installCommand = workspaceRoot ? 'pnpm install --ignore-workspace' : 'pnpm install';
const rerunCommand = command === 'test' ? 'pnpm test' : 'pnpm typecheck';
const fallbackCommand = command === 'test' ? 'npx vitest run' : 'npx tsc --noEmit';
const binaryName = process.platform === 'win32'
  ? command === 'test'
    ? 'vitest.cmd'
    : 'tsc.cmd'
  : command === 'test'
  ? 'vitest'
  : 'tsc';
const binaryArgs = command === 'test' ? ['run'] : ['--noEmit'];
const binaryPath = path.join(projectRoot, 'node_modules', '.bin', binaryName);
const packageChecks = command === 'test'
  ? ['vitest/package.json', 'zod/package.json', '@rawsql-ts/sql-contract/package.json']
  : ['typescript/package.json', 'zod/package.json', '@rawsql-ts/sql-contract/package.json'];

const resolutionIssues = inspectResolution(packageChecks);
if (!existsSync(binaryPath) || resolutionIssues.length > 0) {
  printGuidance({
    command,
    installCommand,
    rerunCommand,
    fallbackCommand,
    workspaceRoot,
    binaryPath,
    resolutionIssues
  });
  process.exit(1);
}

const result = spawnSync(binaryPath, binaryArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
process.exit(result.status ?? 1);

function inspectResolution(specifiers) {
  const projectRequire = createRequire(path.join(projectRoot, 'package.json'));
  const issues = [];

  for (const specifier of specifiers) {
    try {
      const resolvedPath = specifier.endsWith('/package.json')
        ? resolveInstalledPackageManifest(specifier)
        : projectRequire.resolve(specifier);
      if (!isInsideProject(resolvedPath)) {
        issues.push(`${specifier} resolved outside this scaffold: ${normalizePath(resolvedPath)}`);
      }
    } catch {
      issues.push(`${specifier} is not installed in this scaffold`);
    }
  }

  return issues;
}

function resolveInstalledPackageManifest(specifier) {
  const manifestRelativePath = path.join('node_modules', ...specifier.split('/'));
  const manifestPath = path.join(projectRoot, manifestRelativePath);
  if (!existsSync(manifestPath)) {
    throw new Error(`${specifier} manifest is missing`);
  }
  return manifestPath;
}

function isInsideProject(filePath) {
  const relativePath = path.relative(projectRoot, filePath);
  return relativePath.length === 0 || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function findAncestorPnpmWorkspaceRoot(rootDir) {
  let cursor = path.resolve(rootDir);
  while (true) {
    const parentDir = path.dirname(cursor);
    if (parentDir === cursor) {
      return null;
    }
    cursor = parentDir;
    if (existsSync(path.join(cursor, 'pnpm-workspace.yaml'))) {
      return cursor;
    }
  }
}

function printGuidance({
  command,
  installCommand,
  rerunCommand,
  fallbackCommand,
  workspaceRoot,
  binaryPath,
  resolutionIssues
}) {
  const commandLabel = command === 'test' ? 'pnpm test' : 'pnpm typecheck';
  const lines = [
    `[local-source guard] ${commandLabel} cannot run against this scaffold yet.`,
    '',
    'What happened:',
    `- The local binary was not found at ${normalizePath(binaryPath)} or required packages resolved outside this project.`,
  ];

  if (workspaceRoot) {
    lines.push(`- This project sits under pnpm workspace ${normalizePath(workspaceRoot)}, so pnpm may still be using the parent workspace context.`);
  }

  if (resolutionIssues.length > 0) {
    lines.push('- Resolution details:');
    for (const issue of resolutionIssues) {
      lines.push(`  - ${issue}`);
    }
  }

  lines.push(
    '',
    'Next steps:',
    `1. Run ${installCommand}`,
    `2. Re-run ${rerunCommand}`,
    `3. If pnpm still looks absorbed by the parent workspace, try ${fallbackCommand}`
  );
  console.error(lines.join('\n'));
}
