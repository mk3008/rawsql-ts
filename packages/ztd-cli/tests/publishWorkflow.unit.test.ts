import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const publishWorkflowPath = path.resolve(__dirname, '../../../.github/workflows/publish.yml');
const publishWorkflow = fs.readFileSync(publishWorkflowPath, 'utf8');

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
