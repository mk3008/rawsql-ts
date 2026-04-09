---
"@rawsql-ts/ztd-cli": patch
---

Stabilize scaffolded shared imports in deep recursive boundary layouts without rewriting every generated import style.

Generated query-boundary files now use stable shared specifiers for `src/features/_shared/*` and `tests/support/*`, while nearby boundary-local imports stay relative. Starter scaffolds also add the matching package imports, TypeScript paths, and Vitest aliases so deeper boundary splits are less likely to break when code moves into lower child boundaries.
