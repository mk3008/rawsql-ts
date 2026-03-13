# Telemetry Dogfooding Scenarios

This guide records telemetry-focused dogfooding scenarios that are meant to stay in git as regression surfaces.
The goal is not only to prove that telemetry exists, but to preserve the shortest investigation loops where telemetry is the correct next step.

## Scenario A: Query Uses impact-analysis timeline

Use this scenario when a schema-impact scan starts feeling slower or structurally different and you need to know which command phase changed.

### Why telemetry is the right tool here

`query uses` already answers the impact question without telemetry.
Telemetry becomes useful only after the structural path is known and you need to confirm phase boundaries such as:

- option resolution
- spec discovery
- impact aggregation
- output rendering

### Regression surface

- Test file: `packages/ztd-cli/tests/commandTelemetry.unit.test.ts`
- Test name: `query uses telemetry dogfood scenario preserves a stable impact-analysis timeline artifact`

### Expected timeline

```text
start:query uses column
start:resolve-query-options
start:build-query-usage-report
start:spec-discovery
start:impact-aggregation
start:render-query-usage-output
end:query uses column:ok
```

## Scenario B: Model-Gen probe diagnosis timeline

Use this scenario when `model-gen` fails or slows down and the next question is which phase is responsible.

### Why telemetry is the right tool here

`model-gen` has multiple meaningful phases and one explicit probe decision.
Telemetry is useful here because it distinguishes:

- placeholder scan
- probe connection
- probe query column inspection
- type inference
- generated file rendering
- file emission

### Regression surface

- Test file: `packages/ztd-cli/tests/commandTelemetry.unit.test.ts`
- Test name: `model-gen telemetry dogfood scenario preserves the probe diagnosis timeline`

### Expected timeline

```text
start:model-gen
start:resolve-model-gen-inputs
decision:model-gen.probe-mode
start:placeholder-scan
start:probe-client-connect
start:probe-query-columns
start:type-inference
start:render-generated-output
start:file-emit
end:model-gen:ok
```


## Scenario C: Perf run benchmark-phase attribution timeline

Use this scenario when `perf run --dry-run` still returns a structurally correct report, but you need to know whether a regression belongs to option resolution, benchmark execution, or report rendering.

### Why telemetry is the right tool here

`perf run --dry-run` already explains the chosen strategy and evidence shape.
Telemetry becomes useful only when the next question is which command phase drifted.

### Regression surface

- Test file: `packages/ztd-cli/tests/commandTelemetry.unit.test.ts`
- Test name: `perf run telemetry dogfood scenario preserves the benchmark investigation timeline`

### Expected timeline

```text
start:perf run
start:resolve-perf-run-options
start:execute-perf-benchmark
start:render-perf-report
end:perf run:ok
```

## Scenario D: Repository telemetry scaffold replacement loop

Use this scenario when `ztd init --with-sqlclient` claims to scaffold repository telemetry, but you need to prove the generated hook is both safe by default and replaceable by application code.

### Why telemetry is the right tool here

This is the shortest dogfooding loop that answers the real repository integration questions:

- does the scaffold emit structured repository events out of the box?
- is SQL text still suppressed by the default console implementation?
- can application code replace the hook without editing generated internals?

### Regression surface

- Test file: `packages/ztd-cli/tests/init.command.test.ts`
- Test name: `repository telemetry scaffold dogfood scenario keeps the default hook replaceable and conservative`

### Expected assertions

```text
- default hook emits start/success/error repository events
- default console payload omits sqlText unless explicitly enabled
- custom hook receives the structured events directly
- custom hook bypasses the default console sink
```
## What this guide is for

These scenarios are intentionally narrow.
They exist so future changes can answer two regression questions quickly:

1. Did the telemetry path still expose the same investigation phases?
2. Would a maintainer still know where to look next without ad-hoc debugging?

If a future telemetry feature cannot improve one of those two answers, it is probably not a dogfooding priority.
