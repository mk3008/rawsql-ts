# Continuity Ledger
- Goal (incl. success criteria): Resolve the current TypeScript compile errors in `DynamicQueryBuilder`, `ExistsPredicateInjector`, and related tests while hardening the DynamicQueryBuilder suite so EXISTS/NOT EXISTS behaviors stay valid across formatting or error-message changes, including more precise outer-where and strict-mode expectations.
- Constraints/Assumptions: Use Japanese for replies, English for docs/comments, follow the branch workflow (issue-linked branch), confine throwaway files to `./tmp`, and avoid requesting escalated permissions.
- Key decisions: Clarify hardcoded vs dynamic filter wording, match formattedSql fragments via parameter-aware assertions (`:param` absence, order-by expectations), enforce explicit outer WHERE detection and whitespace-tolerant EXISTS/NOT EXISTS checks, and rely on loose regex matches for strict-mode errors to avoid brittle text dependencies.
- State: Hardened DynamicQueryBuilder tests (parameter-aware filtering checks, order-by direction detection, outer WHERE detection, whitespace-tolerant EXISTS/NOT EXISTS matches, strict-mode message regexes, table-specific exists expectations) and reran `pnpm --filter rawsql-ts test tests/transformers/DynamicQueryBuilder.test.ts`.
- Done: Updated the test assertions and documentation to reflect the relaxed stability requirements and confirmed the targeted Vitest run passes.
- Now: Prepare the diff overview, Japanese summary report, conventional commit title, and changeset description for delivery.
- Next: Share the working diff, tests results, handoff summary, and release notes-ready change notice.
- Open questions (UNCONFIRMED if needed): None.
- Working set (files/ids/commands): CONTINUITY.md, packages/core/src/transformers/DynamicQueryBuilder.ts, packages/core/src/transformers/ExistsPredicateInjector.ts, packages/core/tests/transformers/DynamicQueryBuilder.test.ts, `pnpm --filter rawsql-ts test tests/transformers/DynamicQueryBuilder.test.ts`
