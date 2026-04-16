---
title: Repository Telemetry Setup
---

# Repository Telemetry Setup

Use this guide after `ztd init --starter` when you want repository telemetry that helps you debug query behavior without exporting SQL text or bind values by default.

## What to edit after the starter scaffold

Start with these files in the generated project:

- `src/libraries/telemetry/types.ts`
- `src/libraries/telemetry/repositoryTelemetry.ts`
- `src/adapters/console/repositoryTelemetry.ts`

Then wire telemetry into the repository or service layer that actually runs SQL.

Typical edit points are repository constructors and query execution helpers under your feature folder, for example:

- `src/features/<feature>/application/*.ts`
- `src/features/<feature>/persistence/*.ts`
- `src/repositories/*.ts`

## Recommended wiring

Keep `queryId` stable and treat `repositoryName` and `methodName` as human-readable hints.

```ts
import {
  defaultRepositoryTelemetry,
  resolveRepositoryTelemetry,
  type RepositoryTelemetry
} from './libraries/telemetry/repositoryTelemetry.js';

type RepositoryDeps = {
  telemetry?: RepositoryTelemetry;
};

export class UsersRepository {
  private readonly telemetry: RepositoryTelemetry;

  constructor(deps: RepositoryDeps = {}) {
    this.telemetry = resolveRepositoryTelemetry(deps.telemetry ?? defaultRepositoryTelemetry);
  }

  async listActiveUsers(): Promise<void> {
    this.telemetry.emit({
      kind: 'query.execute.start',
      timestamp: new Date().toISOString(),
      queryId: 'users.listActive',
      repositoryName: 'UsersRepository',
      methodName: 'listActiveUsers',
      paramsShape: [
        {
          name: 'active',
          presence: 'present',
          kind: 'scalar',
          isNull: false,
          nullability: 'non-null',
          booleanValue: 'true'
        }
      ],
      transformations: {
        paging: { enabled: true, hasLimit: true },
        sort: { enabled: true, orderByCount: 1 }
      }
    });
  }
}
```

For a console sink, the generated scaffold already provides `createConsoleRepositoryTelemetry()`. You can pass your own logger later:

```ts
import { createConsoleRepositoryTelemetry } from './adapters/console/repositoryTelemetry.js';

const telemetry = createConsoleRepositoryTelemetry({
  logger: console
});
```

If you use pino or OpenTelemetry, keep the adapter in your application code and forward only the structured event. Do not move SQL text or bind values into the shared starter contract.

## What the emitted log should look like

The starter contract keeps the payload intentionally small:

```json
{
  "kind": "query.execute.success",
  "timestamp": "2026-03-27T12:00:00.000Z",
  "queryId": "users.listActive",
  "repositoryName": "UsersRepository",
  "methodName": "listActiveUsers",
  "paramsShape": [
    {
      "name": "active",
      "presence": "present",
      "kind": "scalar",
      "isNull": false,
      "nullability": "non-null",
      "booleanValue": "true"
    }
  ],
  "transformations": {
    "paging": { "enabled": true, "hasLimit": true },
    "sort": { "enabled": true, "orderByCount": 1 }
  },
  "durationMs": 12,
  "rowCount": 5
}
```

For error events, the starter contract keeps `errorName` only. If you need more error detail, add it inside a custom sink-specific wrapper instead of widening the shared contract.

## QueryId present

When a telemetry event includes `queryId`, the investigation flow is:

1. Search the emitted `queryId` in your logs.
2. Open the repository or feature code that emits that ID.
3. Compare `paramsShape` and `transformations` with the runtime behavior you observed.
4. Inspect the underlying `.sql` asset if you need to confirm the actual statement.

This is the fastest path when you already know which repository method was involved.

## When to stop here

If the event already tells you which repository method ran, you usually do not need `ztd query match-observed`.
Use `ztd query match-observed` only when you do not have a stable `queryId`.

