import type { LineageNodeType } from '../../domain/lineage';

export interface SourceReferenceTarget {
  aliases: readonly string[];
  columnNames: readonly string[];
  nodeId: string;
  nodeType?: LineageNodeType;
}
