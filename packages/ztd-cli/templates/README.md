# Zero Table Dependency Project

This project uses Zero Table Dependency (ZTD) to keep SQL, DDL, and tests aligned.

Key folders:
- ztd/ddl: schema files (source of truth)
- src: application SQL and repositories
- tests: ZTD tests and support

Next steps:
1. Update `ztd/ddl/<schema>.sql` if needed.
2. Run `npx ztd ztd-config`.
3. Provide a SqlClient implementation.
4. Run tests (`pnpm test` or `npx vitest run`).