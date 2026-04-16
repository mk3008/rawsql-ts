# Adapters

Technology-specific bindings live here.

- Put driver- or sink-specific code under `src/adapters/<tech>/`.
- Keep each `<tech>` folder singular until it needs child boundaries.
- Do not place runtime clients or adapters under `db/`; reserve `db/` for DDL, migrations, and schema assets.
