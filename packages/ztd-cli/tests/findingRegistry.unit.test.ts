import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { validateFindingRegistry } from '../src/utils/findingRegistry';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

describe('validateFindingRegistry', () => {
  test('accepts the example registry', () => {
    const registry = readJson('docs/guide/finding-registry.example.json');
    expect(validateFindingRegistry(registry)).toEqual([]);
  });

  test('flags malformed registry entries', () => {
    const issues = validateFindingRegistry([
      {
        id: 'F-999',
        title: 'broken entry',
        symptom: 'missing evidence and invalid status',
        source: ['Report'],
        failure_surface: 'internal',
        category: ['docs'],
        severity: 'warning',
        detectability: 'local',
        recurrence_risk: 'low',
        desired_prevention_layer: ['docs_policy'],
        candidate_action: 'add evidence',
        verification_evidence: 'none',
        status: 'done'
      }
    ]);

    expect(issues.some((issue) => issue.field === 'status')).toBe(true);
  });
});
