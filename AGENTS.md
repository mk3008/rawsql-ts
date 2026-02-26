# Package Scope
- Applies to the entire repository subtree rooted at `./`.
- Defines repository-wide contract rules for SQL rewriting, ZTD testing, and contribution safety.
- Serves as the fallback contract when no deeper `AGENTS.md` overrides a rule.

# Policy
## REQUIRED
- Claims in task reports MUST be backed by direct observation.
- Each reported observation MUST include the executed command, exit code, and key output excerpt.
- A failing behavior MUST be reproduced before applying a fix.
- Fix scope MUST follow one-hypothesis/one-fix.
- Reports for troubleshooting and recovery MUST use: `Observations`, `Changes`, `Verification`, `Assumptions`.
- SQL rewrites MUST use AST utilities (`SelectQueryParser`, `SelectAnalyzer`, `splitQueries`) when an AST path is available.
- Regex fallback for SQL rewrite MUST include an inline limitation comment and a tracking issue reference.
- Repository and application SQL MAY use CRUD statements when execution flows through the rewriter.
- Library code MUST NOT bypass rewrite pipelines.
- DDL files, fixtures, and row maps MUST stay consistent with `ztd.config.json` schema settings.
- Changes to schema/search-path behavior MUST update `ztd.config.json`.
- Contributions MUST use `pnpm` and `pnpm --filter <package>` for scoped commands.
- Identifiers, code comments, and documentation content MUST be written in English.
- Throwaway assets MUST be created under `./tmp`.
- Release-worthy changes MUST include a changeset.

## ALLOWED
- Test code MAY import deterministic, side-effect-free normalization/sanitization helpers from source modules.
- Application SQL MAY omit schema qualifiers when schema resolution is configured in `ztd.config.json`.

## PROHIBITED
- Guessing unobserved facts in analysis or reports.
- Bundling unrelated fixes into a single hypothesis/fix step.
- Executing physical schema mutations (`CREATE TABLE`, `ALTER TABLE`, seed `INSERT`) against pg-testkit connections.
- Hand-constructing `QueryResult` objects or mocking `Client#query` to bypass rewrite flow.
- Allowing demo helpers to accept non-array query params or drop named bindings silently.
- Manual formatting edits that bypass configured format/lint scripts.
- Editing package versions directly in `package.json`.
- Leaving debug statements in committed code.

# Mandatory Workflow
- Before opening or updating a PR, these commands MUST pass:
  - `pnpm lint`
  - `pnpm test` or `pnpm --filter <pkg> test`
  - `pnpm build`
- If SQL rewrite logic changes, benchmark commands MUST also run.
- When parser/formatter behavior changes, browser and docs demo bundle update workflow MUST run.

# Hygiene
- Temporary files under `./tmp` MUST be removed before completion unless converted into tracked tests.
- `CONTINUITY.md` MUST stay untracked, MUST be listed in `.gitignore`, and MUST NOT be staged or committed.

# References
- Rationale and architecture: [DESIGN.md](./DESIGN.md)
- Operational procedures and troubleshooting: [DEV_NOTES.md](./DEV_NOTES.md)
