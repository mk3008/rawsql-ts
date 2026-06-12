<!-- generated-by: transfer-docs -->

# Transfer Package Scope Spec

この文書は `@rawsql-ts/transfer` の Package Scope Spec である。

これは Concept Spec ではない。個別概念の意味、責務、非責務、不変条件は `docs/concepts/` 配下の Concept Spec に置く。

この文書は、package 全体の目的、所有境界、外部境界、非目標、全体不変条件、拡張方針を定義する scope harness である。

## Purpose

`@rawsql-ts/transfer` は、DB中心かつSQL-firstの転送制御 package である。

この package は、転送元データソースをSQLで定義し、Destination / Destination Link に基づいて転送SQLと転送実行に必要な状態を管理する。

## In Scope

- SQL-based source definition
- Destination
- Destination Link
- Dirty Key intake and persistence
- Transfer Run
- Work Item
- Dirty Key Processing
- Active Black
- Lineage
- generated transfer SQL metadata
- DB内で評価可能なDDL、SQL、DB function hookを前提にした転送制御

## Out of Scope

- CDC engine の実装または所有
- file loading の実装または所有
- 外部resource ingestion の実装または所有
- scheduler または runtime hosting environment の提供
- source application の業務責務
- destination table の業務意味
- generated docs を source of truth として扱うこと

## Owned Domains

- transfer package が持つDDL、metadata、Concept Spec、DFD、Process Map
- Dirty Key の受け口と永続化
- transfer 実行時に必要なrun/work/current-state/history metadata
- generated transfer SQL をレビュー可能な形で保持するためのmetadata

## External Domains

- 転送元テーブルの変更検知
- CDC runtime
- producer scheduling
- file ingestion
- runtime host
- source application の業務判断
- destination table が表す業務上の意味
- package利用側が定義するDB functionや外部adapter

## Global Invariants

- transfer は DB-centered / SQL-first である。
- transfer は generated SQL をレビュー不能な形へ隠さない。
- transfer は source key や destination key を暗黙に推測しない。
- transfer は logical model を人間レビュー可能な source of truth として扱う。
- generated docs は review view であり、source of truth ではない。
- AI は durable scope、concept、DFD、process meaning を決定しない。人間が承認する。

## Extension Policy

外部I/O、CDC、file loading、scheduler、runtime hosting を transfer core に入れる変更は scope expansion として扱う。

新しい要件が既存scope内の変更か、新しいConcept追加か、外部producer / adapter の責務か、別packageの責務か、out of scopeかをレビューしてから実装へ進む。

## Review Usage

実装レビューでは、個別Conceptだけでなくこの Package Scope Spec も読む。

`scope-rules.json` は、この文書の境界をAIとCLIが参照しやすくするための機械可読review indexである。仕様本文の代替ではない。

検証方針は `docs/testing/TEST_POLICY.md` に置く。Scope Spec は package の所有境界を定義し、Test Policy はその境界内の変更をどの観点で検証するかを定義する。

## Source

- `packages/transfer/docs/scope/SYSTEM_SCOPE.md`
- `packages/transfer/docs/scope/scope-rules.json`
