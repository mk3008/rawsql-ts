import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  AGENTS_TEMPLATE_VERSION,
  copyAgentsTemplate,
  getAgentsInstallPlan,
  getAgentsStatus,
  installAgentsBootstrap,
  parseMarkdownAgentsMarker,
  writeInternalAgentsArtifacts
} from '../../src/utils/agents';

const tmpRoot = path.join(path.resolve(__dirname, '..', '..', '..'), 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function readNormalized(filePath: string): string {
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

test('copyAgentsTemplate writes AGENTS.md, falls back to AGENTS_ztd.md, then stops', () => {
  const workspace = createTempDir('ztd-agents-visible-root');

  const first = copyAgentsTemplate(workspace);
  expect(first).toBeTruthy();
  expect(path.basename(first!)).toBe('AGENTS.md');
  expect(readNormalized(path.join(workspace, 'AGENTS.md'))).toContain('<!-- ztd:agents');
  expect(readNormalized(path.join(workspace, 'AGENTS.md'))).toContain('## Security Notice');

  const second = copyAgentsTemplate(workspace);
  expect(second).toBeTruthy();
  expect(path.basename(second!)).toBe('AGENTS_ztd.md');

  const third = copyAgentsTemplate(workspace);
  expect(third).toBe(null);
});

test('getAgentsInstallPlan lists the full customer bootstrap set for a fresh workspace', () => {
  const workspace = createTempDir('ztd-bootstrap-plan');
  mkdirSync(path.join(workspace, 'src', 'features'), { recursive: true });
  mkdirSync(path.join(workspace, 'tests'), { recursive: true });
  mkdirSync(path.join(workspace, 'ztd', 'ddl'), { recursive: true });

  const plan = getAgentsInstallPlan(workspace);

  expect(plan.createPaths).toEqual(expect.arrayContaining([
    'AGENTS.md',
    'src/AGENTS.md',
    'src/features/AGENTS.md',
    'tests/AGENTS.md',
    'ztd/AGENTS.md',
    'ztd/ddl/AGENTS.md',
    '.codex/config.toml',
    '.codex/agents/planning.md',
    '.codex/agents/troubleshooting.md',
    '.codex/agents/next-steps.md',
    '.agents/skills/quickstart/SKILL.md',
    '.agents/skills/troubleshooting/SKILL.md',
    '.agents/skills/next-steps/SKILL.md'
  ]));
  expect(plan.conflictPaths).toEqual([]);
  expect(plan.customizedPaths).toEqual([]);
});

test('installAgentsBootstrap creates visible guidance and Codex bootstrap files without overwriting existing files', () => {
  const workspace = createTempDir('ztd-bootstrap-install');
  mkdirSync(path.join(workspace, 'src', 'features'), { recursive: true });
  mkdirSync(path.join(workspace, 'tests'), { recursive: true });
  mkdirSync(path.join(workspace, 'ztd', 'ddl'), { recursive: true });
  writeFileSync(path.join(workspace, 'src', 'AGENTS.md'), '# existing\n', 'utf8');

  const written = installAgentsBootstrap(workspace);

  expect(written.created.some((summary) => summary.relativePath === 'AGENTS.md')).toBe(true);
  expect(written.created.some((summary) => summary.relativePath === '.codex/config.toml')).toBe(true);
  expect(written.created.some((summary) => summary.relativePath === '.agents/skills/quickstart/SKILL.md')).toBe(true);
  expect(written.created.some((summary) => summary.relativePath === 'src/AGENTS.md')).toBe(false);
  expect(readNormalized(path.join(workspace, 'src', 'AGENTS.md'))).toBe('# existing\n');
});

test('install plan reports unmanaged conflicts and customized managed files separately', () => {
  const workspace = createTempDir('ztd-bootstrap-status');
  mkdirSync(path.join(workspace, 'src', 'features'), { recursive: true });
  mkdirSync(path.join(workspace, 'tests'), { recursive: true });
  mkdirSync(path.join(workspace, 'ztd', 'ddl'), { recursive: true });

  installAgentsBootstrap(workspace);
  writeFileSync(path.join(workspace, '.codex', 'config.toml'), '# user-owned replacement\n', 'utf8');
  writeFileSync(path.join(workspace, 'AGENTS.md'), `${readNormalized(path.join(workspace, 'AGENTS.md'))}\nmanual edit\n`, 'utf8');

  const plan = getAgentsInstallPlan(workspace);
  expect(plan.conflictPaths).toContain('.codex/config.toml');
  expect(plan.customizedPaths).toContain('AGENTS.md');

  const report = getAgentsStatus(workspace);
  expect(report.targets.find((target) => target.path === '.codex/config.toml')).toMatchObject({
    status: 'unmanaged-conflict',
    installed: true,
    managed: false,
    drift: 'unknown'
  });
  expect(report.targets.find((target) => target.path === 'AGENTS.md')).toMatchObject({
    status: 'customized',
    installed: true,
    managed: true,
    drift: 'modified'
  });
  expect(report.recommendedActions).toContain('review-customized-guidance');
  expect(report.recommendedActions).toContain('inspect-unmanaged-guidance');
});

test('writeInternalAgentsArtifacts creates managed payloads and sidecars unmanaged collisions', () => {
  const workspace = createTempDir('ztd-agents-internal');
  const unmanagedRoot = path.join(workspace, '.ztd', 'agents', 'root.md');
  mkdirSync(path.dirname(unmanagedRoot), { recursive: true });
  writeFileSync(unmanagedRoot, '# user-owned\n', 'utf8');

  const summaries = writeInternalAgentsArtifacts(workspace);
  expect(summaries.some((summary) => summary.relativePath === '.ztd/agents/manifest.json')).toBe(true);
  expect(summaries.some((summary) => summary.relativePath === '.ztd/agents/root.md.ztd.new')).toBe(true);
  expect(readNormalized(unmanagedRoot)).toBe('# user-owned\n');
  expect(existsSync(`${unmanagedRoot}.ztd.new`)).toBe(true);
});

test('parseMarkdownAgentsMarker reads template version and scope', () => {
  const marker = parseMarkdownAgentsMarker('<!-- ztd:agents template_version=2 scope=root -->\n# Title');
  expect(marker).toEqual({ templateVersion: AGENTS_TEMPLATE_VERSION, scope: 'root' });
  expect(parseMarkdownAgentsMarker('# no marker')).toBeNull();
});
