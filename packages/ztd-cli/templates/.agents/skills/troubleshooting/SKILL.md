---
name: customer-troubleshooting
description: Help a customer project debug setup, generation, SQL, or test issues without broad guesses.
---

# Troubleshooting

Use this skill when the project fails to build, lint, or test.

## Use It For

- DDL regeneration issues
- SQL contract drift
- DB-backed smoke test setup failures
- Confusion about which `ztd` command should run next

## Workflow

1. Identify the smallest failing command.
2. Confirm the owning feature or DDL file.
3. Regenerate before rewriting runtime code when the issue starts from DDL.
4. Keep environment blockers explicit.
5. End with the next safe command.
