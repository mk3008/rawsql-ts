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

## What this guide is for

These scenarios are intentionally narrow.
They exist so future changes can answer two regression questions quickly:

1. Did the telemetry path still expose the same investigation phases?
2. Would a maintainer still know where to look next without ad-hoc debugging?

If a future telemetry feature cannot improve one of those two answers, it is probably not a dogfooding priority.
