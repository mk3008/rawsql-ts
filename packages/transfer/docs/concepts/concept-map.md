<!-- generated-by: @rawsql-ts/ddl-docs-cli -->

# Transfer Concept Map

> Generated from `concept-relationship.json`.
> This Markdown is a human review index. Do not edit concept graph facts here by hand.

## Purpose

This document indexes Concept Specs, glossary terms, lifecycle status, and static concept relationships for human review.
Concept meanings, responsibilities, non-responsibilities, and invariants stay in each Concept Spec.
Relationship facts stay in `concept-relationship.json`.

## Defined Concepts

Authoritative Concept Specs with approved source documents.

| Concept ID | Display Name | Spec |
| --- | --- | --- |
| `active-black` | Active Black | [active-black/SPEC.md](active-black/SPEC.md) |
| `black-transfer` | Black Transfer | [black-transfer/SPEC.md](black-transfer/SPEC.md) |
| `destination` | Destination | [destination/SPEC.md](destination/SPEC.md) |
| `destination-link` | Destination Link | [destination-link/SPEC.md](destination-link/SPEC.md) |
| `dirty-key` | Dirty Key | [dirty-key/SPEC.md](dirty-key/SPEC.md) |
| `dirty-key-processing` | Dirty Key Processing | [dirty-key-processing/SPEC.md](dirty-key-processing/SPEC.md) |
| `lineage` | Lineage | [lineage/SPEC.md](lineage/SPEC.md) |
| `physical-delete-transfer` | Physical Delete Transfer | [physical-delete-transfer/SPEC.md](physical-delete-transfer/SPEC.md) |
| `posting-date-lower-bound` | 日付下限制御 | [posting-date-lower-bound/SPEC.md](posting-date-lower-bound/SPEC.md) |
| `red-transfer` | Red Transfer | [red-transfer/SPEC.md](red-transfer/SPEC.md) |
| `transfer-execution` | Transfer Execution | [transfer-execution/SPEC.md](transfer-execution/SPEC.md) |
| `transfer-run` | Transfer Run | [transfer-run/SPEC.md](transfer-run/SPEC.md) |
| `transfer-setting` | Transfer Setting | [transfer-setting/SPEC.md](transfer-setting/SPEC.md) |
| `work-item` | Work Item | [work-item/SPEC.md](work-item/SPEC.md) |

## Glossary Terms

Index terms used across Concept Specs; meanings in metadata are review aids, not authoritative prose.

| Term ID | Display Term | Defined In |
| --- | --- | --- |
| `black-row` | black row / 黒伝 | [black-transfer/SPEC.md](black-transfer/SPEC.md) |
| `destination-row-key` | destination row key | [destination/SPEC.md](destination/SPEC.md), [destination-link/SPEC.md](destination-link/SPEC.md) |
| `destination-table` | destination table | [destination/SPEC.md](destination/SPEC.md) |
| `immutable-transfer-model` | immutable transfer model | [destination/SPEC.md](destination/SPEC.md) |
| `mutable-transfer-model` | mutable transfer model | [destination/SPEC.md](destination/SPEC.md) |
| `red-row` | red row / 赤伝 | [red-transfer/SPEC.md](red-transfer/SPEC.md) |
| `source-key` | source key | [transfer-setting/SPEC.md](transfer-setting/SPEC.md) |

## Planned Or Candidate Concepts

Non-authoritative entries such as aliases, variants, candidates, or future concepts without their own approved Concept Spec.

| Concept ID | Display Name | Status |
| --- | --- | --- |
| `black-insert-transfer` | Black Insert Transfer | `variant` |
| `black-update-transfer` | Black Update Transfer | `variant` |
| `duplicate-control` | Duplicate Control | `candidate` |
| `key-map` | Key Map | `alias` |

## Concept Relationships

Static concept relationships from metadata; relationship facts stay in `concept-relationship.json`.

| From | Kind | To |
| --- | --- | --- |
| `active-black` | `is-distinct-from` | `lineage` |
| `active-black` | `uses` | `destination-link` |
| `active-black` | `uses` | `lineage` |
| `black-insert-transfer` | `variant-of` | `black-transfer` |
| `black-transfer` | `is-distinct-from` | `red-transfer` |
| `black-transfer` | `records` | `lineage` |
| `black-transfer` | `uses` | `active-black` |
| `black-transfer` | `uses` | `destination` |
| `black-update-transfer` | `variant-of` | `black-transfer` |
| `destination-link` | `depends-on` | `transfer-setting` |
| `destination-link` | `must-not-redefine` | `destination` |
| `destination-link` | `uses` | `destination` |
| `destination` | `is-distinct-from` | `transfer-setting` |
| `destination` | `must-not-redefine` | `transfer-setting` |
| `destination` | `uses` | `posting-date-lower-bound` |
| `dirty-key-processing` | `depends-on` | `destination-link` |
| `dirty-key-processing` | `depends-on` | `dirty-key` |
| `dirty-key-processing` | `depends-on` | `transfer-setting` |
| `dirty-key-processing` | `is-distinct-from` | `dirty-key` |
| `dirty-key-processing` | `records` | `transfer-run` |
| `dirty-key` | `is-distinct-from` | `transfer-run` |
| `lineage` | `records` | `destination-link` |
| `lineage` | `records` | `transfer-run` |
| `lineage` | `records` | `transfer-setting` |
| `physical-delete-transfer` | `is-distinct-from` | `red-transfer` |
| `physical-delete-transfer` | `uses` | `active-black` |
| `physical-delete-transfer` | `uses` | `destination` |
| `posting-date-lower-bound` | `depends-on` | `destination` |
| `red-transfer` | `is-distinct-from` | `active-black` |
| `red-transfer` | `records` | `lineage` |
| `red-transfer` | `uses` | `active-black` |
| `red-transfer` | `uses` | `destination` |
| `transfer-execution` | `consumes` | `dirty-key` |
| `transfer-execution` | `produces` | `transfer-run` |
| `transfer-execution` | `produces` | `work-item` |
| `transfer-execution` | `uses` | `active-black` |
| `transfer-execution` | `uses` | `black-transfer` |
| `transfer-execution` | `uses` | `destination` |
| `transfer-execution` | `uses` | `dirty-key-processing` |
| `transfer-execution` | `uses` | `physical-delete-transfer` |
| `transfer-execution` | `uses` | `red-transfer` |
| `transfer-execution` | `uses` | `transfer-setting` |
| `transfer-execution` | `uses` | `work-item` |
| `transfer-run` | `must-not-redefine` | `dirty-key` |
| `transfer-run` | `must-not-redefine` | `transfer-setting` |
| `transfer-run` | `targets` | `transfer-setting` |
| `transfer-setting` | `must-not-redefine` | `destination` |
| `transfer-setting` | `must-not-redefine` | `dirty-key` |
| `transfer-setting` | `uses` | `destination` |
| `transfer-setting` | `uses` | `destination-link` |
| `work-item` | `depends-on` | `dirty-key` |
| `work-item` | `depends-on` | `lineage` |
| `work-item` | `depends-on` | `transfer-setting` |
| `work-item` | `is-distinct-from` | `dirty-key` |
| `work-item` | `uses` | `active-black` |
| `work-item` | `uses` | `destination` |
| `work-item` | `uses` | `dirty-key-processing` |
