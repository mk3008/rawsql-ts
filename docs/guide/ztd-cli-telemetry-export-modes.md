---
title: ztd-cli Telemetry Export Modes
---

# ztd-cli Telemetry Export Modes

`ztd-cli` keeps telemetry opt-in, but once enabled it can export spans in formats that work for local debugging, CI artifacts, and OTLP-compatible collectors.

## Modes

| Mode | Use case | Output |
|------|----------|--------|
| `console` | Default local inspection | JSONL envelopes on `stderr` |
| `debug` | Human-readable local debugging | formatted text lines on `stderr` |
| `file` | CI artifacts or post-run summaries | JSONL file |
| `otlp` | Jaeger / collector inspection | OTLP/HTTP traces |

## CLI examples

### Default console export

```bash
ztd --telemetry query uses table public.users
```

### Human-readable local debug output

```bash
ztd --telemetry --telemetry-export debug query uses table public.users
```

### CI-friendly JSONL artifact

```bash
ztd --telemetry --telemetry-export file --telemetry-file tmp/telemetry/ztd-cli.telemetry.jsonl query uses table public.users
```

Archive `tmp/telemetry/ztd-cli.telemetry.jsonl` with the CI system's normal artifact upload step.

### OTLP/HTTP export for Jaeger or a collector

```bash
ztd --telemetry --telemetry-export otlp --telemetry-endpoint http://127.0.0.1:4318/v1/traces query uses table public.users
```

If `--telemetry-endpoint` is omitted, `ztd-cli` defaults to `http://127.0.0.1:4318/v1/traces`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ZTD_CLI_TELEMETRY` | Enable telemetry when set to a truthy value |
| `ZTD_CLI_TELEMETRY_EXPORT` | Select `console`, `debug`, `file`, or `otlp` |
| `ZTD_CLI_TELEMETRY_FILE` | Override the JSONL artifact path for `file` mode |
| `ZTD_CLI_TELEMETRY_OTLP_ENDPOINT` | Override the OTLP/HTTP traces endpoint |

## Design notes

- Telemetry stays no-op unless explicitly enabled.
- `console` and `debug` keep local inspection simple without requiring a backend.
- `file` mode exists so CI can archive telemetry output without standing up a collector.
- `otlp` mode is intentionally minimal and collector-friendly, so local Jaeger / OpenTelemetry setups can inspect the same spans.
- Redaction and truncation rules from the telemetry policy still apply in every mode.
