import fs from 'node:fs';
import path from 'node:path';
import type { ConnectionLoggerEntry } from '../../ztd-bench-vs-raw/tests/support/diagnostics';

export function getConnectionEventsFileName(tagPrefix: string): string {
  return `${tagPrefix}connection-events.json`;
}

export function persistConnectionEventsToDisk(options: {
  tmpDir: string;
  runTagPrefix: string;
  events: ConnectionLoggerEntry[];
}): void {
  try {
    fs.mkdirSync(options.tmpDir, { recursive: true });
    const fileName = getConnectionEventsFileName(options.runTagPrefix);
    const filePath = path.join(options.tmpDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(options.events, null, 2), 'utf8');
  } catch (error) {
    console.warn('Failed to persist connection events to disk', error);
  }
}

export function loadPersistedConnectionEvents(
  tmpDir: string,
  runTagPrefix = '',
): ConnectionLoggerEntry[] {
  if (!fs.existsSync(tmpDir)) {
    return [];
  }
  const aggregated: ConnectionLoggerEntry[] = [];
  for (const entry of fs.readdirSync(tmpDir)) {
    if (!entry.endsWith('connection-events.json')) {
      continue;
    }
    if (runTagPrefix.length > 0 && !entry.startsWith(runTagPrefix)) {
      continue;
    }
    const filePath = path.join(tmpDir, entry);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as ConnectionLoggerEntry[];
      aggregated.push(...parsed);
    } catch (error) {
      console.warn(`Failed to load connection events from ${entry}`, error);
    }
  }
  return aggregated;
}
