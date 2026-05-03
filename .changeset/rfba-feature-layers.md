---
"@rawsql-ts/ztd-cli": minor
---

Improve RFBA feature scaffolding so `ztd feature scaffold` now generates feature-local `input.ts`, `workflow.ts`, and `output.ts` alongside a thin `boundary.ts`.

The generated boundary now reads as an `input -> workflow -> output` review flow, while workflow code accepts query ports so tests do not need to infer query identity from SQL text that may be transformed before execution. Multi-query `feature tests scaffold` failures now include the discovered query names and concrete `--query` commands to run.
