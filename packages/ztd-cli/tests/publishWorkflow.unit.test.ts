import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const publishWorkflowPath = path.resolve(__dirname, '../../../.github/workflows/publish.yml');
const publishWorkflow = fs.readFileSync(publishWorkflowPath, 'utf8');
const publishedPackageModePath = path.resolve(__dirname, '../../../scripts/verify-published-package-mode.mjs');
const publishedPackageModeScript = fs.readFileSync(publishedPackageModePath, 'utf8');

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
