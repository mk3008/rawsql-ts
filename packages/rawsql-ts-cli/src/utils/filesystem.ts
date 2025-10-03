import { promises as fs } from 'node:fs';
import path from 'node:path';

type CollectOptions = {
  includeBuilt?: boolean;
};

export async function ensureDirectoryExists(dirPath: string, label: string): Promise<void> {
  let stats: { isDirectory(): boolean };
  try {
    stats = await fs.stat(dirPath);
  } catch {
    throw new Error(`${label} not found: ${dirPath}`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`${label} is not a directory: ${dirPath}`);
  }
}

export async function collectSqlFiles(dirPath: string, options: CollectOptions = {}): Promise<string[]> {
  const includeBuilt = options.includeBuilt ?? false;
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.sql')) {
        if (!includeBuilt && entry.name.toLowerCase().endsWith('.built.sql')) {
          continue;
        }
        results.push(entryPath);
      }
    }
  }

  await walk(dirPath);
  return results.sort();
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function stripBom(text: string): string {
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}