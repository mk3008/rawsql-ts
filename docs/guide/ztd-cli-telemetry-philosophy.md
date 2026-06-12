---
title: ztd-cli Telemetry Philosophy
---

# ztd-cli Telemetry Philosophy

`ztd-cli` telemetry exists to help maintainers and advanced users inspect command behavior during investigation, dogfooding, and performance work. It is intentionally **not** part of the default happy path.

## Why telemetry exists

Telemetry is useful when you need to answer questions like these:

- Which command phase is slow or unexpectedly failing?
- Which fallback or output-selection path was taken?
- How does a local dogfooding build behave compared with a published package?
- Can command traces be inspected in a collector without adding a mandatory backend dependency?

That is the scope. `ztd-cli` telemetry is for investigation and optimization, not for everyday usage requirements.

## When to enable it

Enable telemetry when you are:

- Investigating a command failure or performance regression
- Dogfooding new CLI behavior before release
- Capturing CI artifacts for command-level trace review
- Pointing a local collector or Jaeger instance at OTLP output for short-lived inspection
- Verifying SQL recovery and perf loops such as `perf run` plus `perf report diff` during tuning work

Leave it off for normal published-package usage, happy-path setup, and standard project scaffolding.

## Usage examples

### Investigating a slow command

`query uses` が遅いとき、`debug` モードでフェーズごとの所要時間を確認する:

```bash
npx ztd --telemetry --telemetry-export debug query uses table public.users
```

`stderr` にフェーズ名と経過時間が表示されるので、ボトルネックを特定できる。

### CI でトレースをアーティファクトとして保存する

CI パイプライン内で `file` モードを使い、JSONL ファイルを成果物としてアップロードする:

```bash
npx ztd --telemetry --telemetry-export file \
  --telemetry-file tmp/telemetry/lint.jsonl \
  lint src/features/users/persistence
```

失敗時にアーティファクトを確認すれば、どのフェーズでエラーが起きたかを後から追跡できる。

### ローカルの Jaeger でトレースを可視化する

OTLP モードで Jaeger にスパンを送り、ウォーターフォールビューで確認する:

```bash
docker run -d --rm --name jaeger -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
npx ztd --telemetry --telemetry-export otlp perf run --query src/sql/reports/sales.sql
# ブラウザで http://localhost:16686 を開く
```

フラグとエクスポートモードの詳細は [ztd-cli telemetry export modes](./ztd-cli-telemetry-export-modes.md) を参照。

## Why it is disabled by default

Telemetry stays opt-in because `ztd-cli` is a published CLI first.

- The default flow should not require a backend, collector, or trace viewer.
- Normal users should not have to think about exporters just to scaffold or regenerate files.
- Published-package consumers must be able to ignore telemetry completely.
- Optional embedding or exporter integration must not become a hidden runtime requirement.

This is especially important for an AI-first operating model: structured traces are valuable during investigation, but they should remain an explicit tool rather than ambient background reporting.

## Non-goals

Telemetry is **not** intended to become:

- An always-on production reporting channel
- A mandatory dependency for published-package consumers
- A replacement for normal CLI output, docs, or error messages
- A blanket raw-log export path
- A full logs-and-metrics framework by default

Logs and metrics are intentionally deferred unless there is a concrete justification that fits the same safety and opt-in posture.

## Security and privacy caveats

Telemetry must preserve the same narrow boundary in every export mode.

- SQL text, bind values, credentials, DSNs, and filesystem dumps must not be exported.
- Large or highly variable payloads should be truncated instead of emitted verbatim.
- Structured spans and decision events are preferred over raw logs because they are easier to sanitize and reason about.
- If a new telemetry signal cannot be made low-cardinality and safe, it should not be added.

See [ztd-cli telemetry policy](./ztd-cli-telemetry-policy.md) for the concrete schema and redaction rules, and [ztd-cli telemetry export modes](./ztd-cli-telemetry-export-modes.md) for local, CI, and OTLP usage.
