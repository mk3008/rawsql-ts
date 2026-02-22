# @rawsql-ts/ddl-docs-cli

Generate Markdown table definition documents from DDL files.

- DDL is treated as SSOT.
- SQL parsing uses `rawsql-ts`.
- `CREATE TABLE` and `ALTER TABLE ... ADD CONSTRAINT` are applied across the full DDL stream.
- `COMMENT ON TABLE/COLUMN` is parsed via `rawsql-ts`.

## Install

```bash
pnpm --filter @rawsql-ts/ddl-docs-cli build
```

## Usage

```bash
ddl-docs generate --ddl-dir ztd/ddl --out-dir ztd/docs/tables
```

Show help:

```bash
ddl-docs help
ddl-docs help generate
ddl-docs help prune
```

Generated layout:

- `ztd/docs/tables/index.md`
- `ztd/docs/tables/<schema>/index.md`
- `ztd/docs/tables/<schema>/<table>.md`

Options:

- `--ddl-dir <directory>` repeatable recursive directory input
- `--ddl-file <file>` repeatable explicit file input
- `--ddl <file>` alias of `--ddl-file`
- `--ddl-glob <pattern>` repeatable glob pattern input
- `--extensions <csv>` default `.sql`
- `--out-dir <directory>` output root (default `ztd/docs/tables`)
- `--config <path>` optional `ztd.config.json` path
- `--default-schema <name>` schema override for unqualified table names
- `--search-path <csv>` schema search path override
- `--no-index` skip index page generation
- `--strict` fail when warnings exist
- `--column-order <mode>` `definition` (default) or `name`

Prune generated files:

```bash
ddl-docs prune --out-dir ztd/docs/tables
```

Prune preview:

```bash
ddl-docs prune --out-dir ztd/docs/tables --dry-run
```

Optional orphan cleanup:

```bash
ddl-docs prune --out-dir ztd/docs/tables --prune-orphans
```

## VitePress Integration

This tool emits plain Markdown files and index pages.
If you prefer VitePress-side navigation generation, run with `--no-index` and let your site config build navigation from the generated table pages.

## Warnings

Warnings are emitted to `<outDir>/_meta/warnings.json`.
Use `--strict` in CI to treat warnings as failures.

## Memory Notes

Current implementation prioritizes correctness by applying the full DDL stream and aggregating table metadata before rendering.
For large schemas (for example, ~300 tables), follow-up optimization should focus on reducing peak memory by keeping only compact table metadata and discarding statement-level objects early.

## Minimal E2E Sample

See `packages/ddl-docs-cli/examples/minimal-e2e`.
