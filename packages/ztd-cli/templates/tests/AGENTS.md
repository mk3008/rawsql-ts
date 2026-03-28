# Test Guidance

- Keep tests close to the feature they verify when possible.
- Regenerate DDL-derived artifacts before diagnosing missing generated modules.
- Prefer normal `vitest` verification after feature changes.
- Keep repository contracts honest: say whether tests were updated, whether they passed, and what remains unverified.

Use feature-local tests as the first verification surface before adding broader suites.
