# smoke / smoke boundary test plan

This file snapshots the current scaffold contract before AI adds case files.

## Contract Snapshot

- schemaVersion: 1
- featureId: smoke
- testKind: ztd
- resultCardinality: one
- fixedVerifier: tests/support/ztd/harness.ts
- vitestEntrypoint: src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts
- generatedDir: src/features/smoke/queries/smoke/tests/generated
- casesDir: src/features/smoke/queries/smoke/tests/cases
- analysisJson: src/features/smoke/queries/smoke/tests/generated/analysis.json

## Source Files

- src/features/smoke/boundary.ts
- src/features/smoke/queries/smoke/boundary.ts
- src/features/smoke/queries/smoke/smoke.sql
- src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts

## Fixture Candidate Tables

- public.users

## Validation Scenario Hints

- Keep feature-boundary validation separate from the DB-backed execution boundary.
- Validation failures belong in the feature-root mock test lane.
- Required request fields in feature boundary: `user_id`.

## DB Scenario Hints

- Use the fixed app-level harness and query-local cases to keep the ZTD path thin.
- Keep db/input/output visible in the case file so the AI can fill the query contract without re-deriving the scaffold.
- Read from `public.users` by `user_id` so the smoke query proves connectivity and schema wiring.

## Constraint Coverage Boundary

- ZTD currently verifies rewritten SQL input/output, fixture table/column shape, evidence fields, and required INSERT column presence for NOT NULL columns without defaults when table definitions are available.
- Explicit NULL values for NOT NULL columns and simple UNIQUE checks are feasible ZTD preflight candidates, but they are not enforced by the current fixture/CTE rewrite lane.
- Use a traditional physical DB lane for DB-enforced fail-fast behavior today, especially CHECK, foreign key, exclusion, deferrable, partial/expression UNIQUE, collation-sensitive, or full PostgreSQL constraint semantics.

## Unsupported Constraint Follow-up

- TODO: public.users has NOT NULL constraint coverage that is not fully enforced by the ZTD lane; add or run a traditional physical DB case for DB-enforced failure behavior.
- TODO: public.users has UNIQUE constraint coverage that is not fully enforced by the ZTD lane; add or run a traditional physical DB case for DB-enforced failure behavior.

## Ownership

- Generated files live under src/features/smoke/queries/smoke/tests/generated.
- AI-authored case files live under src/features/smoke/queries/smoke/tests/cases.
- Do not edit generated files by hand unless you are intentionally repairing them with --force.
