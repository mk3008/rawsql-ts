import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface ZtdProjectConfig {
  dialect: string;
  ddlDir: string;
  testsDir: string;
}

const CONFIG_NAME = 'ztd.config.json';

export const DEFAULT_ZTD_CONFIG: ZtdProjectConfig = {
  dialect: 'postgres',
  ddlDir: 'ddl',
  testsDir: 'tests'
};

export function resolveZtdConfigPath(rootDir: string = process.cwd()): string {
  return path.join(rootDir, CONFIG_NAME);
}

export function loadZtdProjectConfig(rootDir: string = process.cwd()): ZtdProjectConfig {
  const filePath = resolveZtdConfigPath(rootDir);
  if (!existsSync(filePath)) {
    return DEFAULT_ZTD_CONFIG;
  }

  try {
    // Merge on top of defaults so partial configs remain valid.
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    return {
      dialect: typeof raw.dialect === 'string' ? raw.dialect : DEFAULT_ZTD_CONFIG.dialect,
      ddlDir: typeof raw.ddlDir === 'string' && raw.ddlDir.length ? raw.ddlDir : DEFAULT_ZTD_CONFIG.ddlDir,
      testsDir:
        typeof raw.testsDir === 'string' && raw.testsDir.length ? raw.testsDir : DEFAULT_ZTD_CONFIG.testsDir
    };
  } catch (error) {
    throw new Error(`${CONFIG_NAME} is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function writeZtdProjectConfig(
  rootDir: string,
  overrides: Partial<ZtdProjectConfig> = {}
): void {
  const finalConfig = {
    ...DEFAULT_ZTD_CONFIG,
    ...overrides
  };
  const serialized = `${JSON.stringify(finalConfig, null, 2)}\n`;
  writeFileSync(resolveZtdConfigPath(rootDir), serialized, 'utf8');
}
