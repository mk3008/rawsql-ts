# ZTD Eval Harness

This directory provides an evaluation loop for `ztd-cli` templates and AGENTS guidance.
For self-iteration operating rules and task order, see
[`eval/IMPROVEMENT_PLAN.ja.md`](./IMPROVEMENT_PLAN.ja.md).

## Goals

- Generate playgrounds outside the library repository.
- Run Codex using the playground as working root.
- Isolate `CODEX_HOME` so evaluation does not inherit `~/.codex/AGENTS.md`.
- Produce machine-readable reports under `eval/reports`.
- Inject local package tarballs when some `@rawsql-ts/*` packages are not yet published.
- Score template/AGENTS quality with scope and tracing checks.

## Quick Start

Windows:

```powershell
pwsh -File eval/run.ps1 -Case crud-basic
```

macOS/Linux:

```bash
bash eval/run.sh --case crud-basic
```

Skip AI generation:

```bash
bash eval/run.sh --case crud-basic --skip-ai
```

Run loop mode (5 iterations):

```powershell
pwsh -File eval/run.ps1 -Loop 5 -Scenario crud-basic
```

## Workspace cleanup automation

- Workspaces under `EVAL_WORKSPACE_ROOT` are disposable caches; `eval/reports` stores canonical summaries and KPIs.
- Run `pwsh eval/cleanup-workspaces.ps1` to inspect or purge old workspaces manually; it defaults to a dry run and keeps the newest 3 directories younger than 7 days.
- The harness automatically calls this script after every run: first with `-DryRun` to log candidates, then with `-Force -DryRun:$false` to delete eligible folders.
- The script refuses to operate outside `*_ztd_eval*\\workspaces`, refuses drive roots, and never follows reparse points.
- When verifying cleanup, create a temporary root (for example under `./tmp`) and exercise `-DryRun` before using `-Force`.

## Environment Variables

- `EVAL_WORKSPACE_ROOT`: external workspace root.
  - Default: `$HOME/_ztd_eval/workspaces` (all OSes)
- `EVAL_CODEX_HOME`: Codex home for eval runs.
  - Default: `<workspaceRoot>/_codex_home`
- `CODEX_BIN`: Codex executable (default: `codex`)
- `PNPM_BIN`: pnpm executable (default: `pnpm`)
- `NODE_BIN`: Node executable (default: `node`)
- `EVAL_SANDBOX_MODE`: Codex sandbox mode (default: `workspace-write`)
  - Guard: `danger-full-access` is rejected immediately.

## Report Output

Default report path:

```text
eval/reports/latest.json
```

Loop summary path:

```text
eval/reports/loop-summary-<timestamp>.json
```

Each report includes:

- `workspace_path`
- `cwd_used`
- `codex_home`
- `sandbox_mode`
- `commands[]` with exit code and output head
- `checks[]` with pass/fail and violation count
- `score_breakdown` (`install`, `typecheck`, `test`, `rules`, `architecture`)
- `score_total`

## Local Deps Injection

The harness supports local tarball injection so external playground installs do not depend on unpublished npm packages.

Flow:

1. Pack selected packages from this repo into `eval/_deps_cache/`.
2. Copy `.tgz` files into `<workspace>/_deps/`.
3. Rewrite matching entries in workspace `package.json` to `file:./_deps/<tarball>.tgz`.
4. Run `pnpm install` normally inside the workspace.

Safety rule:

- Only `file:./_deps/...` is allowed for injected dependencies.
- Any `file:` target outside `./_deps/` causes the run to fail.

Configuration:

- Optional `eval/config.json` can define `localDeps`.
- If `eval/config.json` is missing, default is:
  - `["@rawsql-ts/shared-binder"]`

Example:

```json
{
  "localDeps": ["@rawsql-ts/shared-binder"]
}
```

Disable injection (recommended when published deps are available):

```json
{
  "localDeps": []
}
```

Storage:

- Repo-side cache: `eval/_deps_cache/` (packed tarballs, reusable across runs).
- Workspace-side copies: `<workspace>/_deps/*.tgz` (self-contained install inputs).

## Checks

- `forbidden_refs`: fails if generated workspace files/logs reference the library repo path.
- `sql_composition`: hard-fail when SQL string concatenation/interpolation is detected in source code.
- `sql_client_runnable`: fails when SQL assets contain template syntax that is not runnable in SQL clients.
- `sql_rules`: hard-fail on positional SQL params (`$1`) and quoted camelCase aliases.
- `sql_named_params`: named-parameter-only rule detail score axis.
- `sql_alias_style`: camelCase alias rule detail score axis.
- `scope_check`: fails when AI touches files outside allowed scopes.
- `trace_presence`: fails if required trace events are missing or malformed.
- `catalog_trace_quality`: validates trace field quality in runtime code and emitted events.
- `repository_catalog_boundary`: fails when repositories embed inline SQL.
- `contract_drift`: detects repository parameter references not backed by SQL named params.

`scope_check` allowlist:

- `src/ddl/**`, `ztd/ddl/**`
- `src/sql/**`, `src/catalog/**`
- `src/dto/**`, `src/repositories/**`
- `tests/**`

## Trace Metrics

`trace_presence` stores metrics in the report metadata:

- `slowestQueryIds`
- `errorsByQueryId`
- `countsByQueryId`
- `totalEvents`

To capture events during eval, the harness sets `ZTD_TRACE_FILE=<workspace>/tmp/eval-trace-events.jsonl`.

## Score Model

- `install`: 30 points
- `typecheck`: 15 points
- `test`: 15 points
- `rules`: 20 points (`sql_composition`:10, `sql_named_params`:5, `sql_alias_style`:5)
- `architecture`: 20 points (`catalog_trace_quality`:10, `repository_catalog_boundary`:10)

Total: 100 points.

Hard-fail categories:
- `sql_composition`
- `sql_rules`

## Scorecard Interpretation

- `score_total` is a quick indicator; root cause analysis should start from failed checks and command logs.
- A run can have high score and still be unsuccessful if any required check fails.
- Hard-fail categories (`sql_composition`, `sql_rules`) should be fixed first before tuning other categories.
- `rules` score regressions usually map to AGENTS rule clarity gaps.
- `architecture` score regressions usually map to template defaults (catalog/repository boundaries, trace shape).

## Turning Repeated Failures into Template/AGENTS Updates

When a failure cluster repeats across loop runs:
1. Capture evidence from report snippets (`checks[].details`, `commands[].outputHead`).
2. Propose one minimal rule or template change tied to that evidence.
3. Apply only one proposal per cycle (one hypothesis, one fix).
4. Rerun the loop and compare deltas (`pass_rate`, `average_score`, `failure_clusters`).
5. Keep the change only if recurrence decreases or score improves.

## Loop Summary

`eval/loop.ts` aggregates:
- Per-iteration scorecards and failed categories
- Failure clusters with evidence snippets
- Top 5 template/AGENTS change proposals (what/where/why/effect)
- Stop condition status:
  - Primary: 10 consecutive successful runs with avg score >= 95 and min >= 90
  - Secondary: no repeated new failure categories for 5 runs

## Current Limitations

- `query_id`/`specId` enforcement is currently informational only.
  - TODO: once template-level query identity shape is fixed, make this a strict failure rule.
