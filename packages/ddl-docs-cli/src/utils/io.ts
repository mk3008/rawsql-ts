import { writeFileSync } from 'node:fs';

export function normalizeLf(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

export function writeTextFileNormalized(filePath: string, text: string): void {
  writeFileSync(filePath, normalizeLf(text), 'utf8');
}
