# @rawsql-ts/ztd-cli – AGENTS

## AI Guardrails

- For **Postgres dialect** projects, always write ZTD tests using `@rawsql-ts/pg-testkit`. Every CRUD path must flow through its rewrite pipeline; do **not** reimplement fixtures or SELECT rewrites yourself.
- Keep `ztd.config.json` in sync with the schema you expect: the new `ddl` block controls the default schema (`defaultSchema`) and search path (`searchPath`) that pg-testkit uses when resolving unqualified table names. Adjust both the config and your driver options if you ever change the schema targets.
- If the repository lacks `@rawsql-ts/pg-testkit` in `package.json`, recommend `npm install -D @rawsql-ts/pg-testkit` before generating tests.
- Treat `tests/ztd-row-map.generated.ts` as the **sole** row-type contract. Look at `TestRowMap` and the table-specific interfaces in that file for column names, nullability, and TypeScript types.
- Never duplicate DDL definitions or re-derive schema metadata outside of `tests/ztd-row-map.generated.ts`. If a table or column already exists in the row map, reuse it instead of redefining it.
- Tests must import the appropriate row interface from `TestRowMap` (e.g., `TestRowMap['public.users']`) rather than crafting new interfaces.
- The AGENTS template is copied verbatim: `ztd init` writes this into `AGENTS.md` (falling back to `AGENTS_ZTD.md` if a file already exists).

## Formatting and linting

- Run `pnpm format` to normalize TypeScript, SQL, Markdown, and configuration files; do not hand-edit whitespace or indentation when the script is available.
- Use `pnpm lint` before publishing and `pnpm lint:fix` whenever ESLint reports fixable issues; these commands are the single source of truth for linting behavior.
- The generated project wires `simple-git-hooks` + `lint-staged` together so the pre-commit hook executes `pnpm format` on staged files automatically.
