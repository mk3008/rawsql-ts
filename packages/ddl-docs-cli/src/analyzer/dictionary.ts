import { existsSync, readFileSync } from 'node:fs';
import type { ColumnDictionary } from '../types';

export function loadDictionary(pathValue: string | undefined): ColumnDictionary | null {
  if (!pathValue) {
    return null;
  }
  if (!existsSync(pathValue)) {
    throw new Error(`Dictionary file not found: ${pathValue}`);
  }
  const raw = readFileSync(pathValue, 'utf8');
  const parsed = JSON.parse(raw) as Partial<ColumnDictionary>;
  if (typeof parsed !== 'object' || parsed === null || !parsed.columns) {
    throw new Error(`Invalid dictionary format: ${pathValue}`);
  }
  return {
    version: parsed.version ?? 1,
    locales: parsed.locales ?? ['en'],
    columns: parsed.columns,
  };
}

export function resolveLocale(requested: string | undefined, dictionary: ColumnDictionary | null): string {
  if (requested && requested.trim()) {
    return requested.trim();
  }
  const lang = process.env.LANG?.split(/[._-]/)[0];
  if (lang && dictionary?.locales?.includes(lang)) {
    return lang;
  }
  if (dictionary?.locales?.includes('en')) {
    return 'en';
  }
  return dictionary?.locales?.[0] ?? 'en';
}
