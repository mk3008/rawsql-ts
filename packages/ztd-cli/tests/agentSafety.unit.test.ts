import { expect, test } from 'vitest';
import { validateProjectPath, validateResourceIdentifier } from '../src/utils/agentSafety';

test('validateProjectPath rejects traversal outside project root', () => {
  expect(() => validateProjectPath('../outside.txt', '--out', 'C:/repo/project')).toThrow(/inside the current project root/);
});

test('validateResourceIdentifier rejects query fragments and encoded traversal', () => {
  expect(() => validateResourceIdentifier('users?fields=id', '--table')).toThrow(/query or fragment/);
  expect(() => validateResourceIdentifier('%2e%2e/secret', '--table')).toThrow(/encoded path traversal/);
});
