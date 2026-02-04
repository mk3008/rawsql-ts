# AGENTS (src/)

This directory follows the rules in `../AGENTS.md`.

Key reminders:
- All CRUD must be implemented in `.sql` files under `src/sql/<table_name>/`.
- SQL files use named parameters; do not write driver-specific placeholders.
- Do not use `writer.insert/update/remove` for application CRUD.
- Do not inject audit timestamps in application code.
- Repositories must be thin wrappers that load SQL and map results.
