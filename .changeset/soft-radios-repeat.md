---
"@rawsql-ts/ztd-cli": minor
---

Redefine the default project layout around `src/`, `db/ddl/`, and `.ztd/`.

`ztd init` and `ztd init --starter` now treat `db/ddl` as the human-owned schema source of truth and `.ztd` as the tool-managed workspace for generated and support files. The legacy root `ztd/` and `tests/` layout is no longer supported, and the CLI now reports explicit migration guidance when that older layout is detected.

This release also removes `SKILL` scaffold output from the Codex bootstrap path, updates the starter docs and dogfooding prompts to match the current feature scaffold shape, and makes monorepo dogfooding installs keep using the local `@rawsql-ts/ztd-cli` package so the generated project matches the current command surface during verification.
