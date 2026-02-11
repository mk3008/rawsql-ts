# ZTD Eval Harness

This directory provides an evaluation loop for `ztd-cli` templates and AGENTS guidance.
For self-iteration operating rules and task order, see
[`eval/IMPROVEMENT_PLAN.ja.md`](./IMPROVEMENT_PLAN.ja.md).

## Eval Docs Map

- AI entrypoint: [`eval/policy/AI_INSTRUCTIONS.ja.md`](./policy/AI_INSTRUCTIONS.ja.md)
- Fixed policy: [`eval/policy/POLICY.ja.md`](./policy/POLICY.ja.md)
- Human-only decisions: [`eval/policy/HUMAN_RUNBOOK.ja.md`](./policy/HUMAN_RUNBOOK.ja.md)
- Ordered tasks: [`eval/plans/TASKS.md`](./plans/TASKS.md)
- Iteration logs: [`eval/logs/iterations/`](./logs/iterations/)
- Compressed summaries: [`eval/logs/summary/`](./logs/summary/)

Read in order:
1. AI entrypoint (`eval/policy/AI_INSTRUCTIONS.ja.md`)
2. Fixed policy (`eval/policy/POLICY.ja.md`)
3. Ordered tasks (`eval/plans/TASKS.md`)
4. Logs (`eval/logs/iterations/`, `eval/logs/summary/`)

Log storage convention: see [`eval/policy/POLICY.ja.md` (ログ保持ポリシー)](./policy/POLICY.ja.md#ログ保持ポリシー).

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

Each report includes:

- `workspace_path`
- `cwd_used`
- `codex_home`
- `sandbox_mode`
- `commands[]` with exit code and output head
- `checks[]` with pass/fail and violation count
- `score_breakdown` (`install`, `typecheck`, `test`, `checks`)
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
- `sql_rules`: fails on positional SQL params (`$1`) and quoted camelCase aliases.
- `scope_check`: fails when AI touches files outside allowed scopes.
- `trace_presence`: fails if required trace events are missing or malformed.

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
- `typecheck`: 30 points
- `test`: 30 points
- `checks`: 10 points (`sql_rules`, `forbidden_refs`, `scope_check`, `trace_presence`)

## Current Limitations

- `query_id`/`specId` enforcement is currently informational only.
  - TODO: once template-level query identity shape is fixed, make this a strict failure rule.
