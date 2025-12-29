import fs from 'node:fs';
import path from 'node:path';
import type { SessionStat } from '../../ztd-bench/tests/support/diagnostics';

export function getSessionStatsFileName(tagPrefix: string): string {
  return `${tagPrefix}session-stats.json`;
}

export function persistSessionStatsToDisk(options: {
  tmpDir: string;
  runTagPrefix: string;
  stats: SessionStat[];
}): void {
  try {
    fs.mkdirSync(options.tmpDir, { recursive: true });
    const fileName = getSessionStatsFileName(options.runTagPrefix);
    const filePath = path.join(options.tmpDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(options.stats, null, 2), 'utf8');
  } catch (error) {
    console.warn('Failed to persist session stats to disk', error);
  }
}

export function loadPersistedSessionStats(tmpDir: string, runTagPrefix = ''): SessionStat[] {
  if (!fs.existsSync(tmpDir)) {
    return [];
  }
  const aggregated: SessionStat[] = [];
  for (const entry of fs.readdirSync(tmpDir)) {
    if (!entry.endsWith('session-stats.json')) {
      continue;
    }
    if (runTagPrefix.length > 0 && !entry.startsWith(runTagPrefix)) {
      continue;
    }
    const filePath = path.join(tmpDir, entry);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as SessionStat[];
      aggregated.push(...parsed);
    } catch (error) {
      console.warn(`Failed to load session stats from ${entry}`, error);
    }
  }
  return aggregated;
}
