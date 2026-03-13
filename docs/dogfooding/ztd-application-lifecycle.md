# Application Lifecycle Dogfooding

This guide records a WebAPI-oriented development cycle dogfooded against the new `ztd init --app-shape webapi` layout.

The purpose was not to prove a specific framework integration. The purpose was to verify that the generated layout supports a realistic cycle:

1. create application code
2. test it
3. change it
4. test it again
5. deploy persistence changes
6. repeat

## What was tested

The dogfood run used the `demo` DDL and added minimal code only in:

- `src/domain`
- `src/application`
- `src/presentation/http`

The first application change introduced a small task summary flow:

- `src/domain/taskStatus.ts`
- `src/application/taskSummary.ts`
- `src/presentation/http/taskResponse.ts`
- `tests/task-webapi.lifecycle.test.ts`

The second change evolved the same flow to expose `task.description`, while the persistence side added `task_comment`.

## Why this matters

The new layout is only valuable if a normal WebAPI request such as “make the API response richer” does **not** drag the developer straight into ZTD-specific infrastructure rules.

This run verified that the inner application loop can stay in the app-facing layers:

- `domain` for business vocabulary
- `application` for orchestration
- `presentation/http` for transport shape

Only when the schema changed did the loop move into ZTD-specific paths:

- `ztd/ddl`
- generated row maps
- deploy-time migration SQL

## Verified inner loop

Initial loop:

```bash
pnpm ztd ztd-config
pnpm typecheck
pnpm test
```

Observed result:

- The scaffold passed before any SQL-backed repository implementation existed.
- A new application-layer test passed without touching `src/infrastructure/persistence`.
- The generated guidance did not force ZTD concerns into the app-only change.

Second loop after the application/API change:

```bash
pnpm ztd ztd-config
pnpm typecheck
pnpm test
pnpm ztd check contract
```

Observed result:

- `pnpm typecheck` still passed.
- `pnpm test` still passed.
- `pnpm ztd check contract` passed.
- The change remained localized to app-facing layers plus the DDL update.

## Recommended development cycle

For a WebAPI application, prefer two nested loops instead of one mixed loop.

### Loop A: Application inner loop

Use this for request/response shape, use cases, naming, and business rules.

1. Edit `src/domain`, `src/application`, or `src/presentation/http`.
2. Run `pnpm typecheck`.
3. Run `pnpm test`.
4. Repeat until the request/response behavior is right.

### Loop B: Persistence change loop

Use this only when the contract needs new schema or SQL behavior.

1. Edit `ztd/ddl/*.sql`.
2. Run `pnpm ztd ztd-config`.
3. Update persistence-facing code or specs if needed.
4. Run `pnpm typecheck`, `pnpm test`, and `pnpm ztd check contract`.
5. Prepare and apply an explicit migration to the live target.
6. Verify the live schema.

## What `ztd-cli` is in this lifecycle

In this flow, `ztd-cli` is:

- a scaffold generator
- a DDL-to-contract regeneration tool
- a guardrail for persistence-oriented changes

It is not:

- a full Web framework
- a domain model generator
- a migration deployment system

That positioning is important because it keeps the tool honest. The dogfood run succeeded when `ztd-cli` stayed focused on the persistence contract and stayed out of the app-only request/response changes.

## Why the new layout helped

The `webapi` layout made the intended workflow easier to follow:

- app-only changes had obvious homes
- persistence guidance stayed under `src/infrastructure/persistence`
- the root guidance stayed thin
- the developer could move from app code to persistence only when the change actually required it

That is the main value of the new scaffold.

## Takeaway

The practical recommendation after dogfooding is:

1. start in `domain` / `application` / `presentation`
2. move into ZTD paths only when the change needs schema or SQL work
3. regenerate artifacts before deploy
4. keep migration execution explicit

This is the shortest cycle that matched real application work while preserving the purpose of `ztd-cli`.
