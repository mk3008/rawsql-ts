import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.sql',
  '.yaml',
  '.yml',
  '.txt',
  '.toml',
  '.ini',
  '.env',
  '.gitignore'
]);

const SKIP_DIRECTORIES = new Set(['node_modules', '.git', '.pnpm-store', '.next', 'dist', 'build']);
const MAX_TEXT_SIZE_BYTES = 1024 * 1024;

export async function ensureDirectory(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });
}

export async function writeUtf8File(filePath: string, contents: string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, contents, 'utf8');
}

export async function readUtf8File(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8');
}

export async function removeDirectoryRecursive(directoryPath: string): Promise<void> {
  await rm(directoryPath, { recursive: true, force: true });
}

export function looksLikeTextFile(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export async function collectTextFiles(rootPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) {
          continue;
        }
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      if (!looksLikeTextFile(absolutePath)) {
        continue;
      }

      const info = await stat(absolutePath);
      if (info.size > MAX_TEXT_SIZE_BYTES) {
        continue;
      }
      files.push(absolutePath);
    }
  }

  await walk(rootPath);
  return files;
}
