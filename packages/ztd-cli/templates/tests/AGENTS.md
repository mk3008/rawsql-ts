# Test Guidance

- Tests under `packages/ztd-cli/templates/tests/**/*.test.ts` MUST verify rewrite execution, mapping and validation paths, and DTO-shape behavior when the feature depends on ZTD-managed SQL assets.
- Keep tests close to the feature they verify when possible.
- Regenerate DDL-derived artifacts before diagnosing missing generated modules.
- Prefer normal `vitest` verification after feature changes.
- Keep repository contracts honest: say whether tests were updated, whether they passed, and what remains unverified.

Use feature-local tests as the first verification surface before adding broader suites.
