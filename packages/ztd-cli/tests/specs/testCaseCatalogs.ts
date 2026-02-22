import { defineTestCaseCatalog } from '../utils/testCaseCatalog';

function normalizeEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed.includes('@')) {
    throw new Error('invalid email');
  }
  return trimmed;
}

/**
 * Executable catalog covering email normalization behavior.
 */
export const emailCatalog = defineTestCaseCatalog({
  id: 'unit.normalize-email',
  title: 'normalizeEmail',
  description: 'Executable, inference-free specification for internal normalization behavior.',
  definitionPath: 'tests/specs/testCaseCatalogs.ts',
  refs: [
    { label: 'Issue #448', url: 'https://github.com/mk3008/rawsql-ts/issues/448' }
  ],
  cases: [
    {
      id: 'rejects-invalid-input',
      title: 'throws when @ is missing',
      arrange: () => 'invalid-email',
      act: (value) => () => normalizeEmail(value),
      evidence: {
        input: 'invalid-email',
        expected: 'throws',
        error: {
          name: 'Error',
          message: 'invalid email',
          match: 'contains',
        },
        tags: ['validation', 'ep'],
        focus: 'Rejects input without @ before producing normalized output.',
        refs: [
          { label: 'Issue #448', url: 'https://github.com/mk3008/rawsql-ts/issues/448' }
        ],
      },
      assert: (invoke) => {
        try {
          invoke();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('invalid email')) {
            return;
          }
          throw new Error(`Expected invalid email error, got: ${message}`);
        }
        throw new Error('Expected normalizeEmail to throw for invalid input.');
      },
    },
    {
      id: 'trims-and-lowercases',
      title: 'normalizes uppercase + spaces',
      arrange: () => '  USER@Example.COM ',
      act: (value) => () => normalizeEmail(value),
      evidence: {
        input: '  USER@Example.COM ',
        expected: 'success',
        output: 'user@example.com',
        tags: ['normalization', 'ep'],
        focus: 'Ensures trimming and lowercasing run before return.',
      },
      assert: (invoke) => {
        const actual = invoke();
        if (actual !== 'user@example.com') {
          throw new Error(`Expected user@example.com but got ${String(actual)}.`);
        }
      },
    },
    {
      id: 'keeps-valid-address',
      title: 'retains already-normalized email',
      arrange: () => 'alice@example.com',
      act: (value) => () => normalizeEmail(value),
      evidence: {
        input: 'alice@example.com',
        expected: 'success',
        output: 'alice@example.com',
        tags: ['normalization', 'idempotence'],
        focus: 'Ensures already normalized input remains unchanged.',
      },
      assert: (invoke) => {
        const actual = invoke();
        if (actual !== 'alice@example.com') {
          throw new Error(`Expected alice@example.com but got ${String(actual)}.`);
        }
      },
    },
    {
      id: 'accepts-minimal-domain',
      title: 'accepts shortest practical domain form',
      arrange: () => 'a@b.c',
      act: (value) => () => normalizeEmail(value),
      evidence: {
        input: 'a@b.c',
        expected: 'success',
        output: 'a@b.c',
        tags: ['validation', 'bva'],
        focus: 'Ensures minimal local and domain segments are accepted.',
      },
      assert: (invoke) => {
        const actual = invoke();
        if (actual !== 'a@b.c') {
          throw new Error(`Expected a@b.c but got ${String(actual)}.`);
        }
      },
    },
    {
      id: 'keeps-plus-alias',
      title: 'preserves plus alias while normalizing case',
      arrange: () => ' USER+tag@Example.COM ',
      act: (value) => () => normalizeEmail(value),
      evidence: {
        input: ' USER+tag@Example.COM ',
        expected: 'success',
        output: 'user+tag@example.com',
        tags: ['boundary', 'normalization'],
        focus: 'Ensures alias characters are preserved during normalization.',
      },
      assert: (invoke) => {
        const actual = invoke();
        if (actual !== 'user+tag@example.com') {
          throw new Error(`Expected user+tag@example.com but got ${String(actual)}.`);
        }
      },
    },
    {
      id: 'throws-empty-after-trim',
      title: 'throws when trimmed input is empty',
      arrange: () => '   ',
      act: (value) => () => normalizeEmail(value),
      evidence: {
        input: '   ',
        expected: 'throws',
        error: {
          name: 'Error',
          message: 'invalid email',
          match: 'contains',
        },
        tags: ['validation', 'bva'],
        focus: 'Rejects whitespace-only input after trimming.',
      },
      assert: (invoke) => {
        try {
          invoke();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('invalid email')) {
            return;
          }
          throw new Error(`Expected invalid email error, got: ${message}`);
        }
        throw new Error('Expected normalizeEmail to throw for whitespace input.');
      },
    },
  ],
});

/**
 * Tiny smoke catalog used to validate generic runner behavior.
 */
export const alphaCatalog = defineTestCaseCatalog({
  id: 'unit.alpha',
  title: 'alpha',
  definitionPath: 'tests/specs/testCaseCatalogs.ts',
  cases: [
    {
      id: 'a',
      title: 'noop',
      arrange: () => 1,
      act: (value) => () => value,
      evidence: {
        input: 1,
        expected: 'success',
        output: 1,
        tags: ['invariant', 'state'],
        focus: 'Ensures baseline runner and evidence plumbing remain stable.',
      },
      assert: (invoke) => {
        const actual = invoke();
        if (actual !== 1) {
          throw new Error(`Expected 1 but got ${String(actual)}.`);
        }
      },
    },
  ],
});
