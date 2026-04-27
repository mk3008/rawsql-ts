---
"@rawsql-ts/ztd-cli": patch
---

Rename the documented architecture guidance from BFA to RFBA (Review-First Backend Architecture), add a "What Is RFBA?" guide, and clarify the `root-boundary`, `feature-boundary`, and `sub-boundary` structural vocabulary in the `ztd-cli` docs and scaffold README guidance.

This update keeps `boundary.ts` as the default scaffold convention inside `src/features/*` while making it clear that RFBA is defined by review responsibility, DDL as the data-structure source of truth, visible SQL review boundaries, public surfaces, dependency direction, and boundary-local verification rather than by one universal filename.
