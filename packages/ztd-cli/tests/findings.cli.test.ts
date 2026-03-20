import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, expect, test } from 'vitest';
import { registerFindingRegistryCommand } from '../src/commands/findings';

const originalExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = originalExitCode;
});

function createWorkspace(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function createProgram(capture: { stdout: string[]; stderr: string[] }): Command {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => capture.stdout.push(str),
    writeErr: (str) => capture.stderr.push(str)
  });
  registerFindingRegistryCommand(program);
  return program;
}

test('CLI: findings validate writes json output and sets exitCode=0 on success', async () => {
  const workspace = createWorkspace('findings-cli-pass');
  const registryPath = path.join(workspace, 'finding-registry.json');
  const outPath = path.join(workspace, 'artifacts', 'findings.json');
  mkdirSync(path.dirname(outPath), { recursive: true });
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

  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createProgram(capture);
  await program.parseAsync(['findings', 'validate', registryPath, '--format', 'json', '--out', outPath], { from: 'user' });

  expect(process.exitCode).toBe(0);
  const parsed = JSON.parse(readFileSync(outPath, 'utf8'));
  expect(parsed).toMatchObject({ ok: true, entriesChecked: 1, issues: [] });
  expect(capture.stdout.join('')).toBe('');
  expect(capture.stderr.join('')).toBe('');
});

test('CLI: findings validate sets exitCode=1 for invalid registry entries', async () => {
  const workspace = createWorkspace('findings-cli-invalid');
  const registryPath = path.join(workspace, 'finding-registry.json');
  const outPath = path.join(workspace, 'artifacts', 'findings.json');
  mkdirSync(path.dirname(outPath), { recursive: true });
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

  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createProgram(capture);
  await program.parseAsync(['findings', 'validate', registryPath, '--format', 'json', '--out', outPath], { from: 'user' });

  expect(process.exitCode).toBe(1);
  const parsed = JSON.parse(readFileSync(outPath, 'utf8'));
  expect(parsed.ok).toBe(false);
  expect(parsed.issues.some((issue: { field: string }) => issue.field === 'id')).toBe(true);
  expect(capture.stdout.join('')).toBe('');
  expect(capture.stderr.join('')).toBe('');
});
