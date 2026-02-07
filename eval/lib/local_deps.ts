import { copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { ensureDirectory, readUtf8File, writeUtf8File } from './fs';
import { runCommand, type CommandLog } from './exec';

export interface PackResult {
  tgzMap: Record<string, string>;
  commandLogs: CommandLog[];
}

function quoteCmdArg(input: string): string {
  if (!/[ \t"]/g.test(input)) {
    return input;
  }
  return `"${input.replace(/"/g, '\\"')}"`;
}

async function runPnpmCommand(
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv
): Promise<{ exitCode: number | null; log: CommandLog }> {
  if (process.platform === 'win32') {
    const appData = env?.APPDATA ?? process.env.APPDATA ?? '';
    const shimCandidate = appData ? path.join(appData, 'npm', 'pnpm.cmd') : 'pnpm.cmd';
    const shim = existsSync(shimCandidate) ? shimCandidate : 'pnpm.cmd';
    const commandLine = [quoteCmdArg(shim), ...args.map(quoteCmdArg)].join(' ');
    const result = await runCommand({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', commandLine],
      cwd,
      env
    });
    return { exitCode: result.exitCode, log: result.log };
  }

  const result = await runCommand({
    command: 'pnpm',
    args,
    cwd,
    env
  });
  return { exitCode: result.exitCode, log: result.log };
}

function safeName(packageName: string): string {
  return packageName.replace(/[\/@]/g, '-');
}

async function findSingleTgz(directoryPath: string): Promise<string> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const tgzFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
    .map((entry) => path.join(directoryPath, entry.name));
  if (tgzFiles.length !== 1) {
    throw new Error(`Expected exactly one .tgz in ${directoryPath}, found ${tgzFiles.length}`);
  }
  return tgzFiles[0];
}

export async function packLocalDeps(
  repoRoot: string,
  outDir: string,
  pkgs: string[],
  env?: NodeJS.ProcessEnv
): Promise<PackResult> {
  const tgzMap: Record<string, string> = {};
  const commandLogs: CommandLog[] = [];
  await ensureDirectory(outDir);

  for (const packageName of pkgs) {
    const packageOutDir = path.join(outDir, safeName(packageName));
    await ensureDirectory(packageOutDir);

    const args = ['-C', repoRoot, '--filter', packageName, 'pack', '--pack-destination', packageOutDir];
    const commandResult = await runPnpmCommand(args, repoRoot, env);
    commandLogs.push(commandResult.log);
    if (commandResult.exitCode !== 0) {
      throw new Error(
        `Failed to pack ${packageName} (exit=${commandResult.exitCode ?? 'null'})\n${commandResult.log.outputHead}`
      );
    }

    const tgzPath = await findSingleTgz(packageOutDir);
    tgzMap[packageName] = tgzPath;
  }

  return { tgzMap, commandLogs };
}

export async function copyLocalDepsToWorkspace(
  workspace: string,
  tgzMap: Record<string, string>
): Promise<Record<string, string>> {
  const depsDir = path.join(workspace, '_deps');
  await ensureDirectory(depsDir);

  const fileMap: Record<string, string> = {};
  for (const [packageName, tgzAbsolutePath] of Object.entries(tgzMap)) {
    const fileName = path.basename(tgzAbsolutePath);
    const destination = path.join(depsDir, fileName);
    await copyFile(tgzAbsolutePath, destination);
    fileMap[packageName] = `./_deps/${fileName}`;
  }
  return fileMap;
}

export async function patchWorkspacePackageJson(
  workspace: string,
  depFiles: Record<string, string>
): Promise<{ patched: string[]; skipped: string[] }> {
  const packageJsonPath = path.join(workspace, 'package.json');
  const raw = await readUtf8File(packageJsonPath);
  const parsed = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    pnpm?: { overrides?: Record<string, string> };
  };

  const patched = new Set<string>();
  const skipped: string[] = [];

  const patchSection = (section?: Record<string, string>): void => {
    if (!section) {
      return;
    }
    for (const [packageName, relativeFilePath] of Object.entries(depFiles)) {
      if (Object.prototype.hasOwnProperty.call(section, packageName)) {
        section[packageName] = `file:${relativeFilePath}`;
        patched.add(packageName);
      }
    }
  };

  patchSection(parsed.dependencies);
  patchSection(parsed.devDependencies);

  parsed.pnpm = parsed.pnpm ?? {};
  parsed.pnpm.overrides = parsed.pnpm.overrides ?? {};
  for (const [packageName, relativeFilePath] of Object.entries(depFiles)) {
    parsed.pnpm.overrides[packageName] = `file:${relativeFilePath}`;
    patched.add(packageName);
  }

  for (const packageName of Object.keys(depFiles)) {
    if (!patched.has(packageName)) {
      skipped.push(packageName);
    }
  }

  await writeUtf8File(packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`);
  return { patched: [...patched], skipped };
}

export async function assertWorkspaceDepFileLinks(
  workspace: string,
  expectedPackages: string[]
): Promise<void> {
  const packageJsonPath = path.join(workspace, 'package.json');
  const raw = await readUtf8File(packageJsonPath);
  const parsed = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    pnpm?: { overrides?: Record<string, string> };
  };

  const readValue = (packageName: string): string | undefined =>
    parsed.dependencies?.[packageName] ??
    parsed.devDependencies?.[packageName] ??
    parsed.pnpm?.overrides?.[packageName];

  for (const packageName of expectedPackages) {
    const value = readValue(packageName);
    if (!value) {
      continue;
    }
    if (value.startsWith('file:') && !value.startsWith('file:./_deps/')) {
      throw new Error(`Invalid local dep mapping for ${packageName}: ${value}`);
    }
  }
}
