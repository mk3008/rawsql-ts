You are working in a generated ZTD playground.

Implement a minimal CRUD-oriented sample based only on local project files and AGENTS.md in this playground.

Constraints:
- Do not reference any files outside this workspace.
- Do not configure Codex with additional directories.
- Keep SQL and repository/catalog changes minimal and testable.
- Use existing scaffold guidance in this workspace as needed.
- Only edit files under these paths:
  - `src/sql/`
  - `src/catalog/`
  - `src/repositories/`
  - `tests/`
- Do not edit `src/types/`, `tsconfig.json`, `package.json`, or lockfiles.
- If a required file is missing or typecheck/test cannot be fixed within the allowed paths, stop and report:
  - `Not observed: need <required file path>`

Deliverables:
- Add or update SQL under `src/sql`.
- Add or update matching catalog/runtime/repository code if needed.
- Ensure `pnpm typecheck` and `pnpm test` pass.

Output policy:
- Make concrete file edits directly in this workspace.
- Keep changes small and deterministic.
