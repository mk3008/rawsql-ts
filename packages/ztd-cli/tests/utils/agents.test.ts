import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  AGENTS_TEMPLATE_VERSION,
  copyAgentsTemplate,
  getAgentsStatus,
  installVisibleAgents,
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

test('installVisibleAgents creates nested AGENTS templates without overwriting existing files', () => {
  const workspace = createTempDir('ztd-agents-visible-install');
  mkdirSync(path.join(workspace, 'src'), { recursive: true });
  mkdirSync(path.join(workspace, 'ztd'), { recursive: true });
  mkdirSync(path.join(workspace, 'src', 'domain'), { recursive: true });
  writeFileSync(path.join(workspace, 'src', 'AGENTS.md'), '# existing\n', 'utf8');

  const written = installVisibleAgents(workspace);
  expect(written.some((summary) => summary.relativePath === 'AGENTS.md')).toBe(true);
  expect(written.some((summary) => summary.relativePath === 'ztd/AGENTS.md')).toBe(true);
  expect(written.some((summary) => summary.relativePath === 'src/domain/AGENTS.md')).toBe(true);
  expect(written.some((summary) => summary.relativePath === 'src/AGENTS.md')).toBe(false);
  expect(readNormalized(path.join(workspace, 'src', 'AGENTS.md'))).toBe('# existing\n');
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

  const manifest = JSON.parse(readNormalized(path.join(workspace, '.ztd', 'agents', 'manifest.json'))) as {
    managed_by: string;
    template_version: number;
    security_notices: string[];
    routing_rules: Array<{ scope: string }>;
    prompt_examples: Array<{ prompt: string; preferred_scopes: string[]; avoid_scopes: string[] }>;
  };
  expect(manifest.managed_by).toBe('ztd:agents');
  expect(manifest.template_version).toBe(AGENTS_TEMPLATE_VERSION);
  expect(manifest.security_notices).toContain('Never store secrets in instruction files.');
  expect(manifest.routing_rules).toEqual(expect.arrayContaining([expect.objectContaining({ scope: 'src-domain' })]));
  expect(manifest.prompt_examples).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        prompt: 'Convert to WebAPI',
        preferred_scopes: expect.arrayContaining(['src-presentation', 'src-application', 'src-domain'])
      }),
      expect.objectContaining({
        prompt: 'Add SQL and implement repository',
        preferred_scopes: expect.arrayContaining(['src-infrastructure-persistence', 'ztd'])
      })
    ])
  );
});

test('parseMarkdownAgentsMarker reads template version and scope', () => {
  const marker = parseMarkdownAgentsMarker('<!-- ztd:agents template_version=1 scope=root -->\n# Title');
  expect(marker).toEqual({ templateVersion: 1, scope: 'root' });
  expect(parseMarkdownAgentsMarker('# no marker')).toBeNull();
});

test('getAgentsStatus reports none modified and unknown drift states', () => {
  const workspace = createTempDir('ztd-agents-status');
  writeInternalAgentsArtifacts(workspace);
  installVisibleAgents(workspace);

  let report = getAgentsStatus(workspace);
  const internalRoot = report.targets.find((target) => target.path === '.ztd/agents/root.md');
  const visibleRoot = report.targets.find((target) => target.path === 'AGENTS.md');
  expect(internalRoot).toMatchObject({
    installed: true,
    installedVersion: AGENTS_TEMPLATE_VERSION,
    drift: 'none',
    managed: true
  });
  expect(visibleRoot).toMatchObject({
    installed: true,
    installedVersion: AGENTS_TEMPLATE_VERSION,
    drift: 'none',
    managed: true
  });

  writeFileSync(path.join(workspace, '.ztd', 'agents', 'src.md'), '# user-owned replacement\n', 'utf8');
  writeFileSync(path.join(workspace, 'AGENTS.md'), `${readNormalized(path.join(workspace, 'AGENTS.md'))}\nmanual edit\n`, 'utf8');

  report = getAgentsStatus(workspace);
  expect(report.targets.find((target) => target.path === '.ztd/agents/src.md')).toMatchObject({
    installed: true,
    installedVersion: null,
    drift: 'unknown',
    managed: false
  });
  expect(report.targets.find((target) => target.path === 'AGENTS.md')).toMatchObject({
    installed: true,
    installedVersion: AGENTS_TEMPLATE_VERSION,
    drift: 'modified',
    managed: true
  });
  expect(report.recommendedActions).toContain('inspect-unmanaged-agents-files');
  expect(report.recommendedActions).toContain('review-visible-agents');
});

test('getAgentsStatus ignores optional visible templates when their parent directory is absent', () => {
  const workspace = createTempDir('ztd-agents-status-gating');
  mkdirSync(path.join(workspace, 'src'), { recursive: true });
  mkdirSync(path.join(workspace, 'tests'), { recursive: true });

  writeInternalAgentsArtifacts(workspace);
  installVisibleAgents(workspace);
  copyAgentsTemplate(workspace);

  const report = getAgentsStatus(workspace);

  expect(report.targets.some((target) => target.path === 'src/jobs/AGENTS.md')).toBe(false);
  expect(report.targets.some((target) => target.path === 'tests/support/AGENTS.md')).toBe(false);
  expect(report.recommendedActions).not.toContain('install-visible-agents');
});

test('installVisibleAgents treats requiredDirectory as a real directory contract', () => {
  const workspace = createTempDir('ztd-agents-directory-contract');
  writeFileSync(path.join(workspace, 'src'), 'not a directory\n', 'utf8');

  const written = installVisibleAgents(workspace);

  expect(written.some((summary) => summary.relativePath === 'src/AGENTS.md')).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'AGENTS.md'))).toBe(false);
});
