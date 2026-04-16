---
"@rawsql-ts/ztd-cli": patch
---

Align generated project root aliases across `package.json`, `tsconfig.json`, and `vitest.config.ts` so scaffolded code can use `#features/*`, `#libraries/*`, `#adapters/*`, and `#tests/*` consistently.

Starter and scaffold templates now use root aliases for imports that cross canonical roots instead of deep relative paths, which makes generated projects easier to move and reorganize without rewriting import depth.
