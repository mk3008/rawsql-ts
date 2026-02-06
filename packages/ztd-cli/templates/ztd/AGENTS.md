# ztd AGENTS

This directory contains ZTD inputs and related documentation.

## Core rule

- "ztd/ddl/" is the only human-owned source of truth inside "ztd/".
- Do not create new subdirectories under "ztd/" unless explicitly instructed.

## Boundaries

- Runtime code must not depend on "ztd/".
- Tests may reference DDL and generated outputs via ZTD tooling.

## Editing policy

- Avoid modifying "ztd/README.md" unless explicitly asked.
- Prefer adding rules to "ztd/ddl/AGENTS.md" for DDL-related guidance.
