# Minimal E2E Example

Run from repository root:

```bash
pnpm --filter @rawsql-ts/ddl-docs-cli build
node packages/ddl-docs-cli/dist/index.js generate --ddl-dir packages/ddl-docs-cli/examples/minimal-e2e/ddl --out-dir packages/ddl-docs-cli/examples/minimal-e2e/generated
```

Expected outputs:

- `generated/index.md`
- `generated/public/index.md`
- `generated/public/user.md`
- `generated/public/order.md`
- `generated/public/order-item.md`
- `generated/public/columns/index.md`
- `generated/references.md`
