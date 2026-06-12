import { readFileSync } from 'node:fs';
import path from 'node:path';

export function loadSqlResource(currentDir: string, relativePath: string): string {
  return readFileSync(path.join(currentDir, relativePath), 'utf8');
}
