import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ResolvedSchemaSettings } from './types';

interface ZtdConfigLike {
  ddl?: {
    defaultSchema?: string;
    searchPath?: string[];
  };
}

/**
 * Resolves default schema and search path from CLI options and optional ztd config.
 */
export function resolveSchemaSettings(
  explicitConfigPath: string | undefined,
  cliDefaultSchema: string | undefined,
  cliSearchPath: string[] | undefined
): ResolvedSchemaSettings {
  const config = loadZtdConfig(explicitConfigPath);
  const fileDefaultSchema = normalizeIdentifier(config?.ddl?.defaultSchema);
  const fileSearchPath = normalizeSearchPath(config?.ddl?.searchPath);
  const defaultSchema = normalizeIdentifier(cliDefaultSchema) || fileDefaultSchema || 'public';
  const searchPath = normalizeSearchPath(cliSearchPath) || fileSearchPath || [defaultSchema];
  return { defaultSchema, searchPath };
}

function loadZtdConfig(explicitConfigPath: string | undefined): ZtdConfigLike | null {
  const candidates = explicitConfigPath
    ? [path.resolve(explicitConfigPath)]
    : [path.resolve(process.cwd(), 'ztd.config.json')];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    const raw = readFileSync(candidate, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as ZtdConfigLike;
    }
  }
  return null;
}

function normalizeSearchPath(value: string[] | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value.map((entry) => normalizeIdentifier(entry)).filter(Boolean) as string[];
  if (normalized.length === 0) {
    return undefined;
  }
  return Array.from(new Set(normalized));
}

function normalizeIdentifier(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/^"|"$/g, '').toLowerCase();
}
