import { existsSync, mkdirSync } from 'node:fs';

export function ensureDirectory(directory: string): void {
  if (!directory || existsSync(directory)) {
    return;
  }

  // Create the destination hierarchy so calling code can emit files safely.
  mkdirSync(directory, { recursive: true });
}
