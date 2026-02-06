# src/jobs AGENTS

This folder contains script-like operations (procedural SQL execution).

## Scope

- Maintenance jobs
- Data backfills
- Batch operations
- Temporary-table driven workflows

## Safety rules

- Be explicit about transaction boundaries.
- Prefer idempotent design (safe to rerun).
- Emit clear logs/events at start and end of the job.

## SQL usage

- It is acceptable to run multiple statements in a job (including temp tables).
- Avoid coupling job logic to tests-only helpers.

## Testing

- Prefer integration-style tests that verify observable outcomes.
- If the job is heavy, test smaller units or use fixtures to limit scope.
