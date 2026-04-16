---
"@rawsql-ts/ztd-cli": patch
---

Clarify BFA guidance around `root-boundary`, `feature-boundary`, and `sub-boundary` in the `ztd-cli` docs and starter guidance.

This update keeps `boundary.ts` as the default scaffold convention inside `src/features/*` while making it clear that BFA itself is defined by boundary ownership, public surfaces, dependency direction, and boundary-local verification rather than by one universal filename.
