# ztd-cli Agent Interface

`ztd-cli` supports a machine-readable automation path intended for AI agents and scripted callers.

## Core Conventions

- Use `ztd --output json ...` to request a JSON envelope on stdout.
- Expect structured diagnostics on stderr when JSON output is enabled.
- Prefer `--dry-run` before commands that write files.
- Use `--json <payload>` on supported commands when nested option construction is easier than individual flags.

## JSON Envelope

Supported commands emit a JSON object on stdout with this shape:

```json
{
  "schemaVersion": 1,
  "command": "describe command",
  "ok": true,
  "data": {}
}
```

Fields:

- `schemaVersion`: version of the envelope contract
- `command`: normalized command label
- `ok`: success flag
- `data`: command-specific payload

## Introspection

Use `describe` to inspect command capabilities at runtime.

```bash
ztd describe
ztd describe command init
ztd --output json describe command model-gen
```

The detailed form includes:

- whether the command writes files
- whether `--dry-run` is supported
- whether `--json <payload>` is supported
- whether an output contract can be described separately
- expected stdout/files and exit-code meanings

## Write Safety

These commands support `--dry-run`:

- `ztd init`
- `ztd ztd-config`
- `ztd model-gen`
- `ztd ddl pull`
- `ztd ddl diff`
- `ztd ddl gen-entities`

Dry-run validates inputs, resolves paths, and computes outputs without writing repo files.

## Output Controls

For large reports, prefer these controls:

- `ztd query uses ... --summary-only`
- `ztd query uses ... --limit <count>`
- `ztd evidence ... --summary-only`
- `ztd evidence ... --limit <count>`

These options keep agent context windows smaller while preserving headline counts in the report summary.
