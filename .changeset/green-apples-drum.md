---
"@rawsql-ts/ztd-cli": minor
---

Align the starter scaffold and guidance with the canonical directory taxonomy.

Starter projects now treat `src/features`, `src/adapters`, and `src/libraries` as the app-code roots, keep `db/` for DDL and migration assets, keep shared verification support under `tests/support/*`, and keep `.ztd/*` tool-managed.

The scaffolded `SqlClient` and telemetry seams now follow that layout, and the generated README, AGENTS guidance, and tutorial docs describe the same ownership model.
