Goal (including success criteria):
- Ensure `packages/sql-contract/README.md` minimal CRUD sample reflects a usable mapper scenario by showing a typed `Customer` DTO, a simple executor, and the writer helpers, so readers see runnable code that aligns with actual APIs.
- Success: the sample types the SELECT result, uses `createMapperFromExecutor` with `simpleMapPresets.pgLike()`, keeps SQL visible, and demonstrates insert/update/delete helpers executed through the same executor.

Constraints / Assumptions:
- Responses must remain in Japanese; documentation and code comments must stay English.
- README edits should stay limited to packages/sql-contract/README.md and associated continuity notes.

Key decisions:
- Introduce a `Customer` type and a concrete multiline SELECT in the sample so readers can trace how snake_case columns map to DTO fields.
- Keep the demonstration short yet runnable: show executor creation, mapper usage, and writer helpers, without adding leftover scaffolding.

State:
- README minimal sample now declares `Customer`, types the mapper query, and uses an inline executor plus writer helpers; this matches current implementation guidance.

Done:
- Added the typed `Customer` DTO and expanded the SELECT block within the minimal CRUD example to illustrate the mapper in action.
- Kept writer helper usage intact while clarifying that the executor drives all four operations.

Now:
- README sample can serve as a copy/paste starting point for teams wiring sql-contract into their driver code.

Next:
- Await confirmation or any further instructions before finalizing the PR.

Open questions (mark as UNCONFIRMED if needed):
- None.

Working set (files, ids, commands):
```
CONTINUITY.md
packages/sql-contract/README.md
```
