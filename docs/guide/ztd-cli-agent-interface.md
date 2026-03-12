# ztd-cli Agent Interface

`ztd-cli` supports a machine-readable automation path intended for AI agents and scripted callers.

## Core Conventions

- Use `ztd --output json ...` to request a JSON envelope on stdout.
- Expect structured diagnostics on stderr when JSON output is enabled.
- Prefer `--dry-run` before commands that write files.
- Use `--json <payload>` on supported commands when nested option construction is easier than individual flags.
- Read `.ztd/agents/manifest.json` first when you need project guidance without repo-visible `AGENTS.md` files.
- Use `ztd agents status` to distinguish managed templates from user-owned instruction files.
- When a request is "add an optional filter" to a SQL asset, prefer SSSQL-style truthful SQL branches before suggesting string-built SQL assembly outside the file.

For SQL authoring guidance around optional predicates, see [ztd-cli SSSQL Authoring](./ztd-cli-sssql-authoring.md).
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

The full field contract is documented in [ztd-cli Describe Schema](./ztd-cli-describe-schema.md).

Examples:

```bash
ztd --output json agents status
ztd ztd-config --json '{"ddlDir":"ztd/ddl","extensions":".sql,.ddl","dryRun":true}'
ztd check contract --json '{"format":"json","strict":true}'
ztd query uses column --json '{"target":"public.users.email","format":"json","summaryOnly":true}'
ztd lint --json '{"path":"src/sql/**/*.sql"}'
```

## Agent Guidance Discovery

`ztd init` now writes managed internal guidance under `.ztd/agents/` by default:

- `.ztd/agents/manifest.json`
- `.ztd/agents/root.md`
- `.ztd/agents/src.md`
- `.ztd/agents/tests.md`
- `.ztd/agents/ztd.md`

Visible `AGENTS.md` files are opt-in via `ztd agents install`.

The manifest includes:

- template version
- managed ownership marker
- security notices
- visible install targets
- stable guidance entrypoints for automation

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

When output controls are applied, JSON reports include `display` metadata so callers can distinguish truncation from a true zero-result scan.

`query uses` example:

```json
{
  "schemaVersion": 2,
  "view": "detail",
  "summary": {
    "matches": 12,
    "parseWarnings": 0
  },
  "matches": [],
  "warnings": [],
  "display": {
    "summaryOnly": true,
    "totalMatches": 12,
    "returnedMatches": 0,
    "totalWarnings": 1,
    "returnedWarnings": 0,
    "truncated": true
  }
}
```

`evidence` example:

```json
{
  "schemaVersion": 1,
  "mode": "specification",
  "summary": {
    "sqlCatalogCount": 4,
    "testCaseCount": 18
  },
  "display": {
    "summaryOnly": false,
    "limit": 5,
    "truncated": true
  }
}
```
