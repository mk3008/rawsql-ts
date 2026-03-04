# Zero Table Dependency Project

This project uses Zero Table Dependency (ZTD) to keep SQL, DDL, and tests aligned.

Key folders:
- ztd/ddl: schema files (source of truth)
- src: application SQL and repositories
- tests: ZTD tests and support

Next steps:
1. Update `ztd/ddl/<schema>.sql` if needed.
2. Run `npx ztd ztd-config`.
3. Run `npx ztd model-gen --probe-mode ztd <sql-file> --out <spec-file>` when you want a QuerySpec scaffold from the local DDL snapshot.
4. Provide a SqlClient implementation.
5. Run tests (`pnpm test` or `npx vitest run`).
6. Apply the schema to a live database only when you need live-schema helpers such as `ztd model-gen --probe-mode live`, `ztd ddl pull`, or `ztd ddl diff`.
