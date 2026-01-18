# AGENTS: sql-contract Design Principles

This document defines the non-negotiable philosophy for "@rawsql-ts/sql-contract".

The package provides a small, explicit boundary between human-authored raw SQL and application code:

- "mapper" hydrates rows into typed objects using explicit, caller-controlled mappings.
- "writer" emits simple CUD SQL strings and parameter arrays without schema inference.

It must not become an ORM, a schema-aware layer, or a query builder.

---

## Core principles

- "SQL is the specification." This package does not define SQL and does not change SQL semantics.
- No schema knowledge: no DDL parsing, RowMaps, table metadata, or database introspection.
- No implicit inference: prefer explicit configuration and caller intent over guessing.
- DBMS-agnostic by default: database-specific behaviors must be caller-supplied or opt-in.
- Fail fast on ambiguity: unclear mappings or unsafe identifiers must throw.

---

## Mapper responsibilities

- Convert SQL result rows ("Record<string, unknown>") into typed objects using explicit mappings.
- Stitch related objects together via declared relations.
- Avoid hidden inference or duck-typing beyond a small, documented set of "simple-case" helpers.
- Operate only on row data; leave SQL, DDL, RowMaps, or table metadata to callers.
- Stay DBMS-agnostic; treat DBMS-specific features (OID, arrays, JSON, date coercion rules) as caller-supplied behavior.
- Prefer explicit controls over guessing. Supported controls include:
  - column maps
  - prefixes
  - "belongsTo*" relations
  - "typeHints"
  - preset "SimpleMapOptions"
- Throw on:
  - missing columns
  - duplicate normalized names
  - missing relation keys
  - circular relation graphs
  - non-serializable or unsafe keys (as defined by the mapper surface)

Defaults and customization:

- Default normalization is "snake_to_camel".
- Default ID handling:
  - normalize to camelCase, and stringify identifier values for "*Id" keys when configured to do so.
- Callers may override via:
  - "idKeysAsString"
  - "keyTransform"
  - "coerceFn"
  - "typeHints"

"SQL owns the column names; TypeScript adapts explicitly." Ambiguity or schema inference has no place in this mapper surface.

---

## Writer responsibilities

- Emit "INSERT", "UPDATE", and "DELETE" statements as:
  - a visible SQL string, and
  - a parameter array
  The writer must never hide the SQL.
- Require callers to supply table/column identifiers as plain strings.
  - Do not generate identifiers.
  - Do not infer schema.
- Validate identifiers against "[A-Za-z_][A-Za-z0-9_]*" by default.
  - Allow opt-out only with "allowUnsafeIdentifiers: true".
  - Even with opt-out, still reject:
    - empty names
    - control characters
- Refuse ORM-level conveniences:
  - no guessed joins
  - no inferred relationships
  - no schema-based column selection
- Keep the supported WHERE surface intentionally small:
  - equality AND lists only, via caller-provided key objects
  - no complex expressions, OR, subqueries, or function-based predicates
- Drop "undefined" values so only present columns appear in SQL.
- Centralize placeholder numbering ("$1", "$2", ...) and do not introduce:
  - named placeholders
  - DBMS-specific placeholder syntax
- Normalize column and key identifiers (alphabetical order) so both the generated SQL string and the `params` array stay deterministic no matter how objects were created.

The writer helpers exist to keep simple CUD statements legible and parameterized without leaking schema assumptions.
