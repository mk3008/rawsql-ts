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
  cases: [
    {
      id: 'rejects-invalid-input',
      title: 'throws when @ is missing',
      arrange: () => 'invalid-email',
      act: (value) => () => normalizeEmail(value),
      evidence: {
        input: 'invalid-email',
        output: 'Error: invalid email',
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
        output: 'user@example.com',
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
        output: 'alice@example.com',
      },
      assert: (invoke) => {
        const actual = invoke();
        if (actual !== 'alice@example.com') {
          throw new Error(`Expected alice@example.com but got ${String(actual)}.`);
        }
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
        output: 1,
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
