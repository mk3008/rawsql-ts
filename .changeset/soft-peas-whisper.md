---
'@rawsql-ts/ztd-cli': patch
---

Improve ZTD-first dogfooding and scaffold feedback.

- make `ztd init` detect parent pnpm workspaces and use `--ignore-workspace` for its own install step
- add local-source dogfooding guidance for nested workspaces and generated import overrides
- let `ztd model-gen` generate local-friendly `sql-contract` imports via `--import-style` and `--import-from`
- strengthen the default scaffold smoke tests and placeholder diagnostics so wiring mistakes fail with clearer messages
