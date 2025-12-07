import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface ZtdProjectConfig {
  dialect: string;
  ddlDir: string;
  testsDir: string;
  ddl: {
    defaultSchema: string;
    searchPath: string[];
  };
}

const CONFIG_NAME = 'ztd.config.json';

const DEFAULT_DDL_PROPERTIES = {
  defaultSchema: 'public',
  searchPath: ['public']
};

export const DEFAULT_ZTD_CONFIG: ZtdProjectConfig = {
  dialect: 'postgres',
  ddlDir: 'ddl',
  testsDir: 'tests',
  ddl: { ...DEFAULT_DDL_PROPERTIES }
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
    const rawDdl = typeof raw.ddl === 'object' && raw.ddl !== null ? raw.ddl : undefined;
    // Treat only non-empty ddl.searchPath arrays as explicit overrides.
    const rawSearchPath = Array.isArray(rawDdl?.searchPath) ? rawDdl.searchPath : undefined;
    // Detect override intent only when a non-empty searchPath array is provided.
    let hasSearchPathOverrides = false;
    if (rawSearchPath && rawSearchPath.length > 0) {
      hasSearchPathOverrides = true;
    }
    let resolvedSearchPath: string[] = [...DEFAULT_ZTD_CONFIG.ddl.searchPath];
    if (hasSearchPathOverrides && rawSearchPath) {
      resolvedSearchPath = rawSearchPath.filter(
        (schema: unknown): schema is string =>
          typeof schema === 'string' && schema.length > 0
      );
    }
    return {
      dialect: typeof raw.dialect === 'string' ? raw.dialect : DEFAULT_ZTD_CONFIG.dialect,
      ddlDir: typeof raw.ddlDir === 'string' && raw.ddlDir.length ? raw.ddlDir : DEFAULT_ZTD_CONFIG.ddlDir,
      testsDir:
        typeof raw.testsDir === 'string' && raw.testsDir.length ? raw.testsDir : DEFAULT_ZTD_CONFIG.testsDir,
      ddl: {
        defaultSchema:
          typeof rawDdl?.defaultSchema === 'string' && rawDdl.defaultSchema.length
            ? rawDdl.defaultSchema
            : DEFAULT_ZTD_CONFIG.ddl.defaultSchema,
        searchPath: resolvedSearchPath
      }
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
    ...overrides,
    ddl: {
      ...DEFAULT_ZTD_CONFIG.ddl,
      ...(overrides.ddl ?? {})
    }
  };
  const serialized = `${JSON.stringify(finalConfig, null, 2)}\n`;
  writeFileSync(resolveZtdConfigPath(rootDir), serialized, 'utf8');
}
