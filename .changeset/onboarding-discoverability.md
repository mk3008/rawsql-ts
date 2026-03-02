---
"@rawsql-ts/ztd-cli": patch
---

Onboarding & discoverability improvements (Epic #463):

- Add copy-pasteable "Happy Path Quickstart" to README
- Document DDL/schema change workflow with common patterns
- Add `--workflow` and `--validator` flags for non-interactive `ztd init --yes`
- Improve `ztd --help` with "Getting started" and "Common workflow" guidance
- Print next-step hints after `ztd-config` (suppress with `--quiet`)
- Include `fromPg()` SqlClient conversion helper in scaffolded templates
- Add docs for rowMapping/coerce vs validator pipeline order
- Add Postgres pitfalls guide, spec-change scenarios digest, and feature index
