# Perf Scale Tuning Dogfooding

This scenario preserves the shortest dogfooding loop for volume-sensitive SQL tuning.
The goal is to keep the decision between **index tuning** and **pipeline tuning** explicit, reproducible, and backed by QuerySpec metadata plus local DDL.

## Use this scenario when

Use this scenario when a prompt sounds like:

- "This query will run on tens of thousands of rows."
- "Should we add an index or split this into a pipeline?"
- "The QuerySpec already declares a large scale; prove the next tuning branch."

## Required inputs

- QuerySpec `metadata.perf` with at least `expectedScale`, and ideally row expectations.
- `perf/seed.yml` large enough to approximate the intended workload.
- `ztd/ddl/*.sql` containing every physical table and every index you expect the perf sandbox to use.

## Happy-path loop

1. Confirm `metadata.perf` in the QuerySpec.
2. Confirm `ztd perf db reset --dry-run` reports the expected DDL files, table count, and index count.
3. Run `ztd perf run` and inspect:
   - `spec_guidance`
   - `ddl_inventory`
   - `tuning_guidance`
4. If `tuning_guidance.primary_path` is `index`, update DDL and rerun `ztd perf db reset`.
5. If `tuning_guidance.primary_path` is `pipeline`, compare `--strategy direct` and `--strategy decomposed`.
6. Save evidence once the winning branch is stable.

## Regression surface

- Test file: `packages/ztd-cli/tests/perfBenchmark.unit.test.ts`
- Test name: `runPerfBenchmark dry-run reports ddl inventory and pipeline-first tuning guidance for scale dogfooding`
- Test file: `packages/ztd-cli/tests/perfSandbox.unit.test.ts`
- Test name: `inspectPerfDdlInventory counts CREATE INDEX statements so perf reset can recreate them`

## What this scenario protects

- QuerySpec scale metadata remains connected to perf guidance.
- Maintainers can see whether the sandbox DDL already includes the indexes being discussed.
- Index fixes do not stay as throwaway sandbox changes; they are pushed back into DDL.
- Pipeline tuning stays evidence-driven instead of becoming a generic rewrite reflex.