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

## Ownership

- Generated files live under src/features/smoke/queries/smoke/tests/generated.
- AI-authored case files live under src/features/smoke/queries/smoke/tests/cases.
- Do not edit generated files by hand unless you are intentionally repairing them with --force.
