import { describe, expect, it } from 'vitest';
import type { LineageModel } from '../domain/lineage';
import { collectReachableSources } from './probePrerequisiteFacts';

describe('collectReachableSources', () => {
  it('memoizes shared upstream nodes while preserving cycle ambiguity', () => {
    const lineage: LineageModel = {
      analysisWarnings: [],
      edges: [
        { id: 'edge:a-target', source: 'a', target: 'target', type: 'dataFlow' },
        { id: 'edge:b-target', source: 'b', target: 'target', type: 'dataFlow' },
        { id: 'edge:shared-a', source: 'shared', target: 'a', type: 'dataFlow' },
        { id: 'edge:shared-b', source: 'shared', target: 'b', type: 'dataFlow' },
        { id: 'edge:a-shared', source: 'a', target: 'shared', type: 'dataFlow' },
      ],
      kind: 'sql-lineage-model',
      modelVersion: 1,
      nodes: [],
      raw: { adapter: 'rawsql-ts-ast' },
      scopes: [],
    };

    const result = collectReachableSources(lineage, 'target');

    expect([...result.nodeIds].sort()).toEqual(['a', 'b', 'shared']);
    expect([...result.ambiguousNodeIds].sort()).toEqual(['a', 'b', 'shared']);
    expect([...result.traversedEdgeIds].sort()).toEqual([
      'edge:a-shared',
      'edge:a-target',
      'edge:b-target',
      'edge:shared-a',
      'edge:shared-b',
    ]);
  });
});
