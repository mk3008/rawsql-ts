import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type JsonRecord = Record<string, unknown>;

export type ImportAliasSupportStatus = 'supported' | 'absent' | 'partial';

function readJsonRecordIfExists(filePath: string): JsonRecord | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as JsonRecord;
  } catch {
    return null;
  }
}

function hasPackageImport(rootDir: string, importKey: string): boolean {
  const packageJson = readJsonRecordIfExists(path.join(rootDir, 'package.json'));
  if (!packageJson) {
    return false;
  }

  const imports = packageJson.imports;
  return typeof imports === 'object' && imports !== null && importKey in (imports as JsonRecord);
}

function hasTsconfigPath(rootDir: string, pathKey: string): boolean {
  const tsconfig = readJsonRecordIfExists(path.join(rootDir, 'tsconfig.json'));
  if (!tsconfig) {
    return false;
  }

  const compilerOptions = tsconfig.compilerOptions;
  if (!compilerOptions || typeof compilerOptions !== 'object') {
    return false;
  }

  const paths = (compilerOptions as JsonRecord).paths;
  return typeof paths === 'object' && paths !== null && pathKey in (paths as JsonRecord);
}

function hasVitestAlias(rootDir: string, aliasPrefix: string): boolean {
  const configPath = path.join(rootDir, 'vitest.config.ts');
  if (!existsSync(configPath)) {
    return false;
  }

  const contents = readFileSync(configPath, 'utf8');
  return contents.includes(`'${aliasPrefix}'`) || contents.includes(`"${aliasPrefix}"`);
}

export function inspectImportAliasSupport(rootDir: string, options: {
  packageImportKey: string;
  tsconfigPathKey: string;
  vitestAliasPrefix: string;
}): ImportAliasSupportStatus {
  const checks = [
    hasPackageImport(rootDir, options.packageImportKey),
    hasTsconfigPath(rootDir, options.tsconfigPathKey),
    hasVitestAlias(rootDir, options.vitestAliasPrefix)
  ];

  if (checks.every(Boolean)) {
    return 'supported';
  }
  if (checks.every((value) => !value)) {
    return 'absent';
  }
  return 'partial';
}
