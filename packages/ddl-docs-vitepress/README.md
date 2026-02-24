# @rawsql-ts/ddl-docs-vitepress

VitePress-based DB schema documentation site, powered by [`ddl-docs-cli`](../ddl-docs-cli).

## Usage

1. Place your `.sql` DDL files in the `ddl/` directory.
2. Start the dev server:

```bash
pnpm dev
```

3. Or build a static site:

```bash
pnpm build
pnpm preview
```

## How it works

- `pnpm generate` — runs `ddl-docs-cli` to convert DDL files in `ddl/` into Markdown under `docs/tables/`.
- `pnpm dev` / `pnpm build` — runs `generate` first, then starts VitePress.

## Prerequisites

- `ddl-docs-cli` must be built (`packages/ddl-docs-cli/dist/index.js` must exist).
  Run `pnpm --filter @rawsql-ts/ddl-docs-cli build` from the repo root if needed.
- At least one `.sql` file must be present in `ddl/`.
