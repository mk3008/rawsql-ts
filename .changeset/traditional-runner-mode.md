---
"@rawsql-ts/ztd-cli": patch
---

Wire the generated traditional QuerySpec test lane to an active physical runner.

The scaffold now generates traditional test cases that execute against isolated physical database setup, records mode-specific evidence, supports optional `afterDb` assertions, and keeps the starter setup environment dependency available during package tests.
