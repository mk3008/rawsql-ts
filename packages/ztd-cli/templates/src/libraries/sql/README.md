# SQL Library

Keep driver-neutral SQL contracts here.

- `sql-client.ts` defines the app-to-driver contract.
- Driver bindings belong under `src/adapters/<tech>/`, not under `db/`.
- Keep handwritten `.sql` assets inside the feature that owns the workflow.
