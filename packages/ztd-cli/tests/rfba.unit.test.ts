import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, expect, test } from 'vitest';
import {
  formatRfbaInspectionReport,
  inspectRfbaBoundaries,
  registerRfbaCommand,
} from '../src/commands/rfba';
import { setAgentOutputFormat } from '../src/utils/agentCli';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');
const originalFormat = process.env.ZTD_CLI_OUTPUT_FORMAT;

afterEach(() => {
  process.env.ZTD_CLI_OUTPUT_FORMAT = originalFormat;
});

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function writeWorkspaceFile(root: string, relativePath: string, contents = ''): void {
  const filePath = path.join(root, ...relativePath.split('/'));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, 'utf8');
}

test('RFBA inspection discovers starter root, feature, query container, and query sub-boundaries', () => {
  const workspace = createTempDir('rfba-starter');
  writeWorkspaceFile(workspace, 'src/features/README.md', '# Features\n');
  writeWorkspaceFile(workspace, 'src/adapters/README.md', '# Adapters\n');
  writeWorkspaceFile(workspace, 'src/libraries/README.md', '# Libraries\n');
  writeWorkspaceFile(workspace, 'src/features/_shared/loadSqlResource.ts', 'export {};\n');
  writeWorkspaceFile(workspace, 'src/features/orders-list/README.md', '# Orders list\n');
  writeWorkspaceFile(workspace, 'src/features/orders-list/boundary.ts', 'export {};\n');
  writeWorkspaceFile(workspace, 'src/features/orders-list/tests/orders-list.boundary.test.ts', 'test.todo("feature");\n');
  writeWorkspaceFile(workspace, 'src/features/orders-list/queries/list-orders/boundary.ts', 'export {};\n');
  writeWorkspaceFile(workspace, 'src/features/orders-list/queries/list-orders/list-orders.sql', 'select 1;\n');
  writeWorkspaceFile(workspace, 'src/features/orders-list/queries/list-orders/tests/list-orders.boundary.ztd.test.ts', 'test.todo("query");\n');
  writeWorkspaceFile(workspace, 'src/features/orders-list/queries/list-orders/tests/generated/analysis.json', '{}\n');
  writeWorkspaceFile(workspace, 'src/features/orders-list/queries/list-orders/tests/generated/TEST_PLAN.md', '# Plan\n');

  const report = inspectRfbaBoundaries(workspace);

  expect(report.schemaVersion).toBe(1);
  expect(report.expectedRootBoundaryPaths).toEqual(['src/features', 'src/adapters', 'src/libraries']);
  expect(report.summary).toMatchObject({
    rootBoundaries: 3,
    featureBoundaries: 1,
    childBoundaryContainers: 1,
    subBoundaries: 1,
    warnings: 0,
  });
  expect(report.boundaries.map((boundary) => boundary.path)).toEqual([
    'src/adapters',
    'src/features',
    'src/features/orders-list',
    'src/features/orders-list/queries',
    'src/features/orders-list/queries/list-orders',
    'src/libraries',
  ]);

  const queriesContainer = report.boundaries.find((boundary) => boundary.path === 'src/features/orders-list/queries');
  expect(queriesContainer).toMatchObject({
    kind: 'child-boundary-container',
    publicBoundary: false,
    publicSurfaceFiles: [],
  });

  const featureBoundary = report.boundaries.find((boundary) => boundary.path === 'src/features/orders-list');
  expect(featureBoundary).toMatchObject({
    kind: 'feature-boundary',
    publicSurfaceFiles: ['src/features/orders-list/boundary.ts', 'src/features/orders-list/README.md'],
    localVerificationFiles: ['src/features/orders-list/tests/orders-list.boundary.test.ts'],
  });
  expect(featureBoundary?.sqlAssets).toEqual([]);
  expect(featureBoundary?.generatedArtifacts).toEqual([]);

  const queryBoundary = report.boundaries.find((boundary) => boundary.path === 'src/features/orders-list/queries/list-orders');
  expect(queryBoundary).toMatchObject({
    kind: 'sub-boundary',
    publicSurfaceFiles: ['src/features/orders-list/queries/list-orders/boundary.ts'],
    sqlAssets: ['src/features/orders-list/queries/list-orders/list-orders.sql'],
    generatedArtifacts: [
      'src/features/orders-list/queries/list-orders/tests/generated/analysis.json',
      'src/features/orders-list/queries/list-orders/tests/generated/TEST_PLAN.md',
    ],
    localVerificationFiles: [
      'src/features/orders-list/queries/list-orders/tests/generated/analysis.json',
      'src/features/orders-list/queries/list-orders/tests/generated/TEST_PLAN.md',
      'src/features/orders-list/queries/list-orders/tests/list-orders.boundary.ztd.test.ts',
    ],
  });
});

test('RFBA inspection reports malformed boundary evidence without failing the read-only command', () => {
  const workspace = createTempDir('rfba-malformed');
  writeWorkspaceFile(workspace, 'src/features/billing-export/README.md', '# Billing\n');
  writeWorkspaceFile(workspace, 'src/features/billing-export/queries/orphan.sql', 'select 1;\n');
  mkdirSync(path.join(workspace, 'src', 'features', 'billing-export', 'queries', 'missing-contract'), { recursive: true });

  const report = inspectRfbaBoundaries(workspace);

  expect(report.summary).toMatchObject({
    rootBoundaries: 1,
    featureBoundaries: 1,
    childBoundaryContainers: 1,
    subBoundaries: 1,
    warnings: 4,
  });
  expect(report.boundaries.find((boundary) => boundary.path === 'src/features/billing-export')?.warnings).toEqual([
    'Feature boundary does not expose the starter public surface file boundary.ts.',
  ]);
  expect(report.boundaries.find((boundary) => boundary.path === 'src/features/billing-export/queries')?.warnings).toEqual([
    'queries/ contains direct files; query assets should usually live under queries/<query>/ sub-boundaries.',
  ]);
  expect(report.boundaries.find((boundary) => boundary.path === 'src/features/billing-export/queries/missing-contract')?.warnings).toEqual([
    'Query sub-boundary does not contain a SQL asset.',
    'Query sub-boundary does not expose boundary.ts.',
  ]);
});

test('RFBA JSON output is deterministic and text output identifies queries as a non-public container', () => {
  const workspace = createTempDir('rfba-json');
  writeWorkspaceFile(workspace, 'src/features/orders-list/boundary.ts', 'export {};\n');
  writeWorkspaceFile(workspace, 'src/features/orders-list/queries/list-orders/boundary.ts', 'export {};\n');
  writeWorkspaceFile(workspace, 'src/features/orders-list/queries/list-orders/list-orders.sql', 'select 1;\n');

  const first = formatRfbaInspectionReport(inspectRfbaBoundaries(workspace), 'json');
  const second = formatRfbaInspectionReport(inspectRfbaBoundaries(workspace), 'json');
  expect(second).toBe(first);

  const text = formatRfbaInspectionReport(inspectRfbaBoundaries(workspace), 'text');
  expect(text).toContain('src/features/orders-list/queries [child-boundary-container] (not public boundary)');
  expect(text).toContain('src/features/orders-list/queries/list-orders/list-orders.sql');
});

test('rfba inspect help exposes the read-only inspection surface', async () => {
  setAgentOutputFormat('text');
  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => capture.stdout.push(str),
    writeErr: (str) => capture.stderr.push(str),
  });
  registerRfbaCommand(program);

  await expect(program.parseAsync(['rfba', 'inspect', '--help'], { from: 'user' })).rejects.toMatchObject({
    code: 'commander.helpDisplayed',
  });
  const stdout = capture.stdout.join('');
  expect(stdout).toContain('Inspect RFBA root, feature, and query sub-boundaries without writing files');
  expect(stdout).toContain('--format <format>');
  expect(stdout).toContain('--root <path>');
  expect(stdout).toContain('--json <payload>');
});
