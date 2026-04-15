# Multiple DB Clients in One Workflow

`ztd-config` can produce separate artifacts for multiple DB contexts. At runtime, treat each context as its own `SqlClient` from `src/libraries/sql/sql-client.ts` and keep the clients side by side when a single workflow needs to talk to more than one database.

```ts
type AppClients = {
  dbA: SqlClient;
  dbB: SqlClient;
};

async function runWorkflow(clients: AppClients) {
  const users = await createUsersRepository(clients.dbA).listActiveUsers();
  const invoices = await createBillingRepository(clients.dbB).listOpenInvoices();

  return { users, invoices };
}
```

This is the minimum runtime step needed for multi-DB workflows. It is not saga orchestration itself; it is the client-binding pattern that makes a saga-style design possible later.

See the proof test in [packages/testkit-postgres/tests/client.test.ts](../../packages/testkit-postgres/tests/client.test.ts).
