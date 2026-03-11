# ztd-cli Describe Schema

`ztd describe` is the runtime contract surface for command discovery.

## Envelope

When `--output json` is enabled, `describe` uses the standard command envelope:

```json
{
  "schemaVersion": 1,
  "command": "describe",
  "ok": true,
  "data": {}
}
```

## `ztd describe`

`data` contains the command catalog:

```json
{
  "schemaVersion": 1,
  "commands": [
    {
      "name": "model-gen",
      "summary": "Probe SQL metadata and generate QuerySpec scaffolding.",
      "writesFiles": true,
      "supportsDryRun": true,
      "supportsJsonPayload": true,
      "supportsDescribeOutput": true
    }
  ]
}
```

Fields:

- `name`: stable command identifier
- `summary`: short human-readable intent
- `writesFiles`: whether the command can mutate the workspace
- `supportsDryRun`: whether `--dry-run` is supported
- `supportsJsonPayload`: whether `--json <payload>` is supported
- `supportsDescribeOutput`: whether the command exposes a secondary output contract

## `ztd describe command <name>`

`data.command` contains the full descriptor:

```json
{
  "schemaVersion": 1,
  "command": {
    "name": "ztd-config",
    "summary": "Generate TestRowMap and layout metadata from local DDL.",
    "writesFiles": true,
    "supportsDryRun": true,
    "supportsJsonPayload": true,
    "output": {
      "stdout": "Status or JSON envelope.",
      "files": [
        "tests/generated/ztd-row-map.generated.ts",
        "tests/generated/ztd-layout.generated.ts"
      ]
    },
    "exitCodes": {
      "0": "Generation completed or dry-run plan emitted.",
      "1": "Generation failed."
    },
    "flags": [
      {
        "name": "--dry-run",
        "description": "Render and validate generation without writing files."
      }
    ]
  }
}
```

Fields:

- `output.stdout`: stdout contract summary when present
- `output.files`: expected file outputs when the command writes artifacts
- `exitCodes`: deterministic exit-code meanings
- `flags`: supported machine-relevant flags and defaults

## Stability

- `schemaVersion` is the contract version for the describe payload itself.
- New fields may be added in a backward-compatible way.
- Existing field names and meanings should not change without a `schemaVersion` bump.
