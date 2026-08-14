# MCP integration evaluation harness

This harness measures whether a generic Codex agent can discover and use the
existing rawsql-ts MCP tools without being told tool names or a rawsql-specific
workflow.

The evaluation has two layers:

- `run-natural.ps1` provisions an isolated workspace for each scenario and runs
  fresh Codex CLI sessions while capturing JSONL traces, stderr, timing, and token
  usage.
- `summarize-runs.mjs` compares observed tool calls with the frozen per-scenario
  policy and reports selection precision/recall, unnecessary and redundant calls,
  host schema warnings, result bytes, latency, and run-to-run stability.

Development scenarios are visible in `scenarios.dev.json`. Holdout scenarios are
deterministically generated and frozen by hash before the first source change.
They must be executed only once after the final development candidate is chosen.

```powershell
node scripts/mcp-integration-eval/generate-holdout.mjs
pwsh scripts/mcp-integration-eval/freeze-ground-truth.ps1
pwsh scripts/mcp-integration-eval/run-natural.ps1 -ScenarioSet dev -Iteration baseline -Repetitions 3
node scripts/mcp-integration-eval/summarize-runs.mjs tmp/mcp-integration-eval/runs/baseline
```

The runner deliberately uses only generic guidance: use available tools when
helpful, avoid runtime claims unsupported by static evidence, and answer the user.
Changing that guidance to mention rawsql tool names, argument names, or a preferred
tool sequence invalidates comparison with earlier iterations.
