import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { formatFindingRegistryValidationResult, runValidateFindingRegistry } from '../src/commands/findings';

function createWorkspace(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'ztd-findings-'));
}

describe('runValidateFindingRegistry', () => {
  test('accepts the example registry', () => {
    const root = createWorkspace();
    const registryPath = path.join(root, 'finding-registry.example.json');
    writeFileSync(
      registryPath,
      JSON.stringify([
        {
          id: 'F-001',
          title: 'example',
          symptom: 'example symptom',
          source: ['Report'],
          failure_surface: 'internal',
          category: ['docs'],
          severity: 'warning',
          detectability: 'local',
          recurrence_risk: 'low',
          desired_prevention_layer: ['docs_policy'],
          candidate_action: 'add guidance',
          verification_evidence: 'docs test',
          status: 'planned'
        }
      ]),
      'utf8'
    );

    const result = runValidateFindingRegistry(registryPath, root);
    expect(result.ok).toBe(true);
    expect(result.entriesChecked).toBe(1);
    expect(result.issues).toHaveLength(0);
  });

  test('flags malformed registry entries', () => {
    const root = createWorkspace();
    const registryPath = path.join(root, 'finding-registry.bad.json');
    writeFileSync(
      registryPath,
      JSON.stringify([
        {
          id: '',
          title: 'broken',
          symptom: 'missing fields',
          source: ['Report'],
          failure_surface: 'internal',
          category: ['docs'],
          severity: 'warning',
          detectability: 'local',
          recurrence_risk: 'low',
          desired_prevention_layer: ['docs_policy'],
          candidate_action: 'fix it',
          verification_evidence: 'none',
          status: 'done'
        }
      ]),
      'utf8'
    );

    const result = runValidateFindingRegistry(registryPath, root);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.field === 'id')).toBe(true);
    expect(result.issues.some((issue) => issue.field === 'status')).toBe(true);
  });

  test('formats a human summary', () => {
    const text = formatFindingRegistryValidationResult(
      {
        ok: false,
        registryPath: '/tmp/findings.json',
        entriesChecked: 1,
        issues: [{ index: 0, field: 'status', message: 'status must be one of: planned, implemented, evidence_collected, verified.' }]
      },
      'human'
    );

    expect(text).toContain('Finding registry has 1 issue');
    expect(text).toContain('entry 0 / status');
  });
});
