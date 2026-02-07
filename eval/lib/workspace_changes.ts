import { createHash } from 'node:crypto';
import path from 'node:path';
import { collectTextFiles, readUtf8File } from './fs';

export interface WorkspaceSnapshotEntry {
  relativePath: string;
  digest: string;
}

export interface WorkspaceDiff {
  created: string[];
  modified: string[];
  deleted: string[];
  touched: string[];
}

function normalizeRelativePath(rootPath: string, absolutePath: string): string {
  return path.relative(rootPath, absolutePath).replace(/\\/g, '/');
}

export async function snapshotWorkspaceTextFiles(rootPath: string): Promise<Map<string, WorkspaceSnapshotEntry>> {
  const files = await collectTextFiles(rootPath);
  const snapshot = new Map<string, WorkspaceSnapshotEntry>();

  for (const filePath of files) {
    const text = await readUtf8File(filePath);
    const relativePath = normalizeRelativePath(rootPath, filePath);
    const digest = createHash('sha1').update(text).digest('hex');
    snapshot.set(relativePath, { relativePath, digest });
  }

  return snapshot;
}

export function diffWorkspaceSnapshots(
  before: Map<string, WorkspaceSnapshotEntry>,
  after: Map<string, WorkspaceSnapshotEntry>
): WorkspaceDiff {
  const created: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const [relativePath, afterEntry] of after) {
    const beforeEntry = before.get(relativePath);
    if (!beforeEntry) {
      created.push(relativePath);
      continue;
    }
    if (beforeEntry.digest !== afterEntry.digest) {
      modified.push(relativePath);
    }
  }

  for (const relativePath of before.keys()) {
    if (!after.has(relativePath)) {
      deleted.push(relativePath);
    }
  }

  const touched = [...new Set([...created, ...modified, ...deleted])].sort();
  return { created: created.sort(), modified: modified.sort(), deleted: deleted.sort(), touched };
}
