import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import type { CTEComposerOptions, SqlFormatterOptions } from 'rawsql-ts';

export type RawSqlCliConfig = {
  formatter?: SqlFormatterOptions;
  cteComposer?: CTEComposerOptions;
};

export type LoadedRawSqlConfig = {
  path: string;
  config: RawSqlCliConfig;
};

const CONFIG_CANDIDATES = [
  'rawsqlconfig.json',
  'rawsql.config',
  'rawsql.config.json',
  'rawsql.config.js',
  'rawsql.config.cjs',
  'rawsql.config.mjs',
];

export async function loadRawSqlConfig(startDir: string = process.cwd()): Promise<LoadedRawSqlConfig | null> {
  // Walk up from the starting directory to locate a supported config file.
  const configPath = await findConfigFile(startDir);
  if (!configPath) {
    return null;
  }

  // Resolve and normalize the configuration contents according to supported shapes.
  const configObject = await readConfig(configPath);
  const normalized = normalizeConfig(configObject, configPath);
  return { path: configPath, config: normalized };
}

async function findConfigFile(startDir: string): Promise<string | null> {
  // Traverse parent directories until a candidate config file is found or we reach the filesystem root.
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (true) {
    for (const candidate of CONFIG_CANDIDATES) {
      const candidatePath = path.join(currentDir, candidate);
      if (await pathExists(candidatePath)) {
        return candidatePath;
      }
    }

    if (currentDir === root) {
      return null;
    }

    currentDir = path.dirname(currentDir);
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readConfig(configPath: string): Promise<unknown> {
  // Infer loader strategy from the extension to support both data files and executable modules.
  const extension = path.extname(configPath).toLowerCase();

  if (extension === '' || extension === '.json') {
    const raw = await fs.readFile(configPath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse JSON in ${configPath}: ${message}`);
    }
  }

  if (extension === '.js' || extension === '.mjs') {
    const moduleUrl = pathToFileURL(configPath).href;
    const module = await import(moduleUrl);
    return module.default ?? module.config ?? module;
  }

  if (extension === '.cjs') {
    const require = createRequire(configPath);
    const module = require(configPath);
    return module.default ?? module.config ?? module;
  }

  throw new Error(`Unsupported configuration format: ${extension || 'unknown'} (${configPath})`);
}

function normalizeConfig(value: unknown, configPath: string): RawSqlCliConfig {
  if (!isPlainObject(value)) {
    // Provide descriptive type label for clearer error reporting.
    const descriptor = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    throw new Error(`Configuration file must export an object (received ${descriptor}) at ${configPath}`);
  }

  // Accept either explicit buckets or a flat object representing composer options.
  const config: RawSqlCliConfig = {};

  if ('formatter' in value) {
    const formatter = value.formatter;
    if (formatter !== undefined) {
      if (!isPlainObject(formatter)) {
        throw new Error(`'formatter' in ${configPath} must be an object`);
      }
      config.formatter = formatter as SqlFormatterOptions;
    }
  }

  if ('cteComposer' in value) {
    const composer = value.cteComposer;
    if (composer !== undefined) {
      if (!isPlainObject(composer)) {
        throw new Error(`'cteComposer' in ${configPath} must be an object`);
      }
      config.cteComposer = composer as CTEComposerOptions;
    }
  }

  if (!('formatter' in value) && !('cteComposer' in value)) {
    config.cteComposer = value as CTEComposerOptions;
  }

  return config;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  // Validate that the value is a plain object to guard against arrays and null.
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
