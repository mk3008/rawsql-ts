---
title: ztd-cli Telemetry Policy
---

# ztd-cli Telemetry Policy

`ztd-cli` telemetry is intentionally narrow. The sink is useful only when it captures stable decision points and phase boundaries without leaking SQL text, DSNs, credentials, or other high-cardinality payloads.

## Decision-event schema

Decision events use a fixed schema. Adding a new event means updating the source schema in `packages/ztd-cli/src/utils/telemetry.ts`, documenting it here, and deciding which low-cardinality attributes are safe to export.

| Event name | Category | When it fires | Allowed attributes |
|------------|----------|---------------|--------------------|
| `command.selected` | command lifecycle | A CLI command path is selected and root telemetry starts | `command` |
| `command.completed` | command lifecycle | A CLI command path completes successfully | `command` |
| `model-gen.probe-mode` | probe mode selected | `model-gen` decides between `live` and `ztd` probe mode | `probeMode` |
| `watch.invalid-with-dry-run` | invalid option guard | `ztd-config` rejects `--watch` with `--dry-run` | none |
| `command.options.resolved` | fallback activated / config planning | `ztd-config` resolves the option state that affects generation flow | `dryRun`, `watch`, `quiet`, `shouldUpdateConfig`, `jsonPayload` |
| `config.updated` | config mutation | `ztd-config` persists ddl-related config overrides | none |
| `output.json-envelope` | output mode selected | A command emits a machine-readable JSON envelope | none |
| `watch.enabled` | watch activation | `ztd-config` enters watch mode after the first successful generation | none |
| `output.dry-run-diagnostic` | output truncation / guidance selection | Dry-run guidance is emitted instead of writing files | none |
| `output.next-steps-diagnostic` | guidance emission | Interactive next-step guidance is emitted | none |
| `output.quiet-suppressed` | generated output suppressed | Quiet mode suppresses follow-up guidance | none |

## Reserved event categories

The current implementation already emits the events above and reserves the following categories for future additions when they become useful enough to keep stable:

- `fallback activated`
- `generated files excluded`
- `probe mode selected`
- `ambiguous resolution detected`
- `parse recovery applied`
- `output truncation applied`

Future events in those categories should follow the same rules: low-cardinality names, explicit allowed attributes, and source plus docs updates in the same change.

## Redaction policy

The telemetry sink sanitizes span attributes, decision-event attributes, and exception payloads before writing JSON lines to `stderr`.

### Never export

- Raw SQL text
- Bind values
- Credentials, secrets, tokens, or auth material
- DSNs / connection URLs
- Full filesystem dumps or other multi-line directory snapshots
- Highly variable large payloads
- Exception stack traces

### Allowed to export

- Stable command names
- Boolean toggles such as `dryRun` or `watch`
- Small numeric counters such as `paramCount` or `directoryCount`
- Stable mode names such as `probeMode`
- Project-scoped file paths when they are not secrets and not bulk dumps

### Sanitization behavior

- Decision events drop attributes that are not listed in the schema.
- Sensitive keys such as `sqlText`, `databaseUrl`, `bindValues`, or `password` are replaced with `[REDACTED]`.
- Strings that look like SQL text, DSNs, or secret-bearing key-value pairs are replaced with `[REDACTED]` even if the key is generic.
- Large or multi-line strings are replaced with `[TRUNCATED:<length>]` to avoid high-cardinality exports.
- Exceptions keep a sanitized `name` and `message`, but do not export stacks.

## Testing expectation

Telemetry changes should ship with tests that capture stderr payloads directly and verify both of these constraints:

1. Expected decision events and phase spans are still emitted.
2. Sensitive fields are absent or redacted in the exported JSON.
