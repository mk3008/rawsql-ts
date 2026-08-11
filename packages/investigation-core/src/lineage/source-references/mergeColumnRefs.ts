import type { LineageColumnRef } from '../../domain/lineage';

export function mergeColumnRefs(left: LineageColumnRef[], right: LineageColumnRef[]): LineageColumnRef[] {
  const merged: LineageColumnRef[] = [];
  const seen = new Set<string>();
  for (const ref of [...left, ...right]) {
    const key = `${ref.nodeId}.${ref.columnName}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(ref);
    }
  }
  return merged;
}
