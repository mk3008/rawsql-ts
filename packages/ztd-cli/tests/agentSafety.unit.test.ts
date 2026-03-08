import path from 'node:path';
import { expect, test } from 'vitest';
import { validateProjectPath, validateResourceIdentifier } from '../src/utils/agentSafety';

test('validateProjectPath resolves a valid relative path inside the project root', () => {
  expect(validateProjectPath('src/file.ts', '--out', '/repo/project')).toBe(path.resolve('/repo/project', 'src/file.ts')); 
});

test('validateProjectPath rejects traversal outside project root', () => {
  expect(() => validateProjectPath('../outside.txt', '--out', 'C:/repo/project')).toThrow(/inside the current project root/);
});

test('validateResourceIdentifier trims and preserves valid identifiers', () => {
  expect(validateResourceIdentifier('public.users', '--table')).toBe('public.users');
  expect(validateResourceIdentifier('  my_schema  ', '--schema')).toBe('my_schema');
});

test('validateResourceIdentifier rejects query fragments and encoded traversal', () => {
  expect(() => validateResourceIdentifier('users?fields=id', '--table')).toThrow(/query or fragment/);
  expect(() => validateResourceIdentifier('%2e%2e/secret', '--table')).toThrow(/encoded path traversal/);
});


test('validateResourceIdentifier rejects control characters', () => {
  expect(() => validateResourceIdentifier(`user${String.fromCharCode(0)}name`, '--table')).toThrow(/control characters/);
});
