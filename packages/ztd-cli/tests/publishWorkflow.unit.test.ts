import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const publishWorkflowPath = path.resolve(__dirname, '../../../.github/workflows/publish.yml');
const publishWorkflow = fs.readFileSync(publishWorkflowPath, 'utf8');
const prCheckWorkflowPath = path.resolve(__dirname, '../../../.github/workflows/pr-check.yml');
const prCheckWorkflow = fs.readFileSync(prCheckWorkflowPath, 'utf8');
const releasePrWorkflowPath = path.resolve(__dirname, '../../../.github/workflows/release-pr.yml');
const releasePrWorkflow = fs.readFileSync(releasePrWorkflowPath, 'utf8');
const publishedPackageModePath = path.resolve(__dirname, '../../../scripts/verify-published-package-mode.mjs');
const publishedPackageModeScript = fs.readFileSync(publishedPackageModePath, 'utf8');
const generatedProjectModePath = path.resolve(__dirname, '../../../scripts/verify-generated-project-mode.mjs');
const generatedProjectModeScript = fs.readFileSync(generatedProjectModePath, 'utf8');

test('publish workflow verifies built artifacts before actual publish', () => {
  expect(publishWorkflow).toContain('verify_publish_artifacts:');
  expect(publishWorkflow).toContain('Run publish artifact verification');
  expect(publishWorkflow).toContain('--publish-manifest "${{ steps.artifacts_contract.outputs.publish_manifest_path }}"');
});

test('actual_publish depends on publish artifact verification', () => {
  expect(publishWorkflow).toContain('needs: [verify_publish_readiness, build_publish_artifacts, verify_publish_artifacts]');
});

test('proof mode skips the main-branch requirement and actual publish', () => {
  expect(publishWorkflow).toContain("if: ${{ inputs.verification_mode != 'proof' }}");
  expect(publishWorkflow).toContain("if: ${{ needs.verify_publish_readiness.outputs.should_publish == 'true' && inputs.verification_mode != 'proof' }}");
  expect(publishWorkflow).toContain('create-publish-proof-plan.mjs');
});

test('release PR workflow requires the changesets PAT instead of silently falling back to GITHUB_TOKEN', () => {
  expect(releasePrWorkflow).toContain('name: Require release PR token');
  expect(releasePrWorkflow).toContain('Release PR requires the CHANGESETS_TOKEN secret.');
  expect(releasePrWorkflow).toContain('GITHUB_TOKEN: ${{ secrets.CHANGESETS_TOKEN }}');
  expect(releasePrWorkflow).not.toContain('secrets.CHANGESETS_TOKEN || secrets.GITHUB_TOKEN');
});

test('pr check reruns when the PR body is edited or the draft is marked ready for review', () => {
  expect(prCheckWorkflow).toContain('types: [opened, reopened, synchronize, edited, ready_for_review]');
});

test('standalone pnpm proof apps use the installed ztd bin helper instead of pnpm exec', () => {
  expect(publishedPackageModeScript).toContain('function getInstalledBinPath(directory, binName) {');
  expect(publishedPackageModeScript).toContain('function runInstalledZtdCli(directory, args) {');
  expect(publishedPackageModeScript).toContain('pnpm-workspace.yaml');

  const starterSection = publishedPackageModeScript.slice(
    publishedPackageModeScript.indexOf('function verifyPnpmStarterPath(packages) {'),
    publishedPackageModeScript.indexOf('function verifyPnpmAdapterInstall(packages) {'),
  );
  expect(starterSection).toContain('runInstalledZtdCli(appDir,');
  expect(starterSection).not.toContain('"exec"');

  const adapterSection = publishedPackageModeScript.slice(
    publishedPackageModeScript.indexOf('function verifyPnpmAdapterInstall(packages) {'),
    publishedPackageModeScript.indexOf('function verifyPnpmTutorialModelGen(packages) {'),
  );
  expect(adapterSection).toContain('runInstalledZtdCli(appDir,');
  expect(adapterSection).not.toContain('"exec"');

  const tutorialSection = publishedPackageModeScript.slice(
    publishedPackageModeScript.indexOf('function verifyPnpmTutorialModelGen(packages) {'),
    publishedPackageModeScript.indexOf('function verifyOverwriteSafety(packages) {'),
  );
  expect(tutorialSection).toContain('runInstalledZtdCli(appDir,');
  expect(tutorialSection).not.toContain('"exec",');
});

test('published-package mode includes the rawsql-ts getting-started smoke path', () => {
  expect(publishedPackageModeScript).toContain('function verifyCoreGettingStarted(packages) {');
  expect(publishedPackageModeScript).toContain("name: \"rawsql-ts-getting-started-check\"");
  expect(publishedPackageModeScript).toContain("await import('rawsql-ts')");
  expect(publishedPackageModeScript).toContain('const builder = new DynamicQueryBuilder();');
  expect(publishedPackageModeScript).toContain('const formatter = new SqlFormatter();');
});

test('overwrite safety uses the installed ztd bin so npm does not consume --force', () => {
  const overwriteSection = publishedPackageModeScript.slice(
    publishedPackageModeScript.indexOf('function verifyOverwriteSafety(packages) {'),
    publishedPackageModeScript.indexOf('function main() {'),
  );

  expect(overwriteSection).toContain('runInstalledZtdCli(appDir, ["init", "--yes", "--workflow", "demo", "--validator", "zod"])');
  expect(overwriteSection).toContain('runInstalledZtdCli(appDir, ["init", "--yes", "--force", "--workflow", "demo", "--validator", "zod"])');
  expect(overwriteSection).not.toContain('"exec"');
});

test('standalone pnpm proof apps pin tarball overrides at the workspace root', () => {
  expect(publishedPackageModeScript).toContain('function syncStandaloneWorkspacePackageJson(overrides) {');
  expect(publishedPackageModeScript).toContain('writePackageJson(standalonePackageRoot, {');
  expect(publishedPackageModeScript).toContain('syncStandaloneWorkspacePackageJson(tarballDependencies);');
});

test('generated-project mode skips the initial install and reapplies local-source overrides before pnpm install', () => {
  expect(generatedProjectModeScript).toContain('"--skip-install"');
  expect(generatedProjectModeScript).toContain('function applyLocalSourceOverrides(appDir) {');
  expect(generatedProjectModeScript).toContain('runIn(generatedProjectRoot, PNPM, ["install", "--ignore-workspace", "--no-frozen-lockfile"])');
  expect(generatedProjectModeScript).toContain('runIn(generatedProjectRoot, PNPM, [');
  expect(generatedProjectModeScript).toContain('"run"');
  expect(generatedProjectModeScript).toContain('"ztd"');
});
