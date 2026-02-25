# @rawsql-ts/ddl-docs-vitepress

A scaffold generator for VitePress-based database schema documentation sites.

This package provides the `ddl-docs-vitepress init` command, which creates a ready-to-use project template that:

- reads SQL files from `ddl/`
- generates Markdown docs via `@rawsql-ts/ddl-docs-cli`
- serves/builds a VitePress site from `docs/`

## Generated project structure

```
my-db-docs/
├── .github/workflows/deploy-docs.yml   # GitHub Pages deploy workflow
├── .gitignore
├── ddl/.gitkeep                        # Place your .sql files here
├── docs/
│   ├── index.md
│   └── .vitepress/
│       ├── config.mts
│       └── theme/
│           ├── custom.css
│           └── index.ts
├── package.json
└── scripts/run-generate.cjs            # Calls ddl-docs-cli to generate Markdown
```

## Create a scaffold project

```bash
npx @rawsql-ts/ddl-docs-vitepress init my-db-docs
cd my-db-docs
npm install
```

### Safe-by-default init behavior

- If target directory does not exist: scaffold is created.
- If target directory exists and is empty: scaffold is created.
- If target directory exists and is not empty: command fails by default.
- Use `--force` to overwrite template paths in a non-empty directory.
- `--force` is overwrite-only. It does not remove non-template files.
- Use `--force --clean` to remove non-template files before scaffolding.

```bash
npx @rawsql-ts/ddl-docs-vitepress init existing-dir --force
npx @rawsql-ts/ddl-docs-vitepress init existing-dir --force --clean
```

Warning: `--clean` removes non-template files and directories in the target path.

### Help

```bash
npx @rawsql-ts/ddl-docs-vitepress --help
npx @rawsql-ts/ddl-docs-vitepress help
npx @rawsql-ts/ddl-docs-vitepress init --help
```

## Use the generated scaffold project

In the generated project:

1. Put your `.sql` files under `ddl/`.
   The build script applies `--filter-pg-dump` automatically, so `pg_dump` output can be used directly — statements such as `SET`, `ALTER ... OWNER TO`, and `SELECT pg_catalog.*` are filtered out before parsing.
2. Start local development:

```bash
npm run dev
```

3. Build static docs:

```bash
npm run build
```

4. Preview the built site:

```bash
npm run preview
```

### GitHub Pages deployment

The scaffold includes `.github/workflows/deploy-docs.yml` which automatically builds and deploys docs to GitHub Pages on pushes to `main` that touch `ddl/` or `docs/.vitepress/`. The workflow sets `VITEPRESS_BASE` from the repository name.

To enable it, go to your repository's **Settings > Pages** and set the source to **GitHub Actions**.

### `VITEPRESS_BASE` for subpath hosting

The scaffold template uses `process.env.VITEPRESS_BASE ?? '/'` in `docs/.vitepress/config.mts`.
Set `VITEPRESS_BASE` when deploying under a subpath (for example GitHub Pages):

```bash
VITEPRESS_BASE=/my-repo/ npm run build
```

## Scripts in this package (maintainer note)

In `packages/ddl-docs-vitepress` itself:

- `pnpm build` compiles this CLI package with `tsc`.
- It does **not** build the generated VitePress docs site.
