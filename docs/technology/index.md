<!-- generated-by: transfer-docs -->

# Transfer Package Technology Policy

この文書は `@rawsql-ts/transfer` の package-level technology policy である。

これは Concept Spec ではない。個別概念の意味、責務、非責務、不変条件は `docs/concepts/` 配下の Concept Spec に置く。

この文書は、package の標準技術選定と、その選定から外れる変更をレビュー対象にするための implementation constraint harness である。

## Purpose

`@rawsql-ts/transfer` は、PostgreSQL、SQL-first、Ashiba / rawsql-ts を標準経路にした転送制御 package である。

コードから現在の実装技術を観測することはできるが、コードだけでは「その技術が意図した制約なのか、偶然の現状なのか」を判定しにくい。

この文書は、未知の要件が来たときに、技術選定の例外、scope expansion、または別 boundary の責務として扱うべきかを判断するために使う。

## Standard Technology Constraints

- Primary database: PostgreSQL
- Data access style: SQL-first
- Standard generation / verification path: Ashiba and rawsql-ts
- Standard transfer implementation path: reviewed SQL, DDL metadata, queryspec contracts, generated mapper checks, and DB-backed tests
- Standard front-facing surface: CLI
- Web UI is not a standard surface for this package. If a Web surface is needed, treat it as an owning application boundary outside `@rawsql-ts/transfer`.

## Non-Standard Paths

以下は標準経路ではない。

- ORM を transfer の標準 data access path として導入すること
- PostgreSQL 以外を transfer の primary database 前提にすること
- SQL-first の代わりに ORM model-first / schema-first を標準にすること
- generated SQL を人間がレビューできない runtime 内部だけに閉じ込めること
- Web UI を transfer package の標準front-facing surface として扱うこと

## Exception Policy

標準経路から外れる変更は、禁止ではなく review-trigger として扱う。

例外を採用する場合は、少なくとも次を明示する。

- なぜ既存の PostgreSQL / SQL-first / Ashiba / rawsql-ts 経路では不足するのか
- 例外が一時的な adapter なのか、package の標準経路を変える scope expansion なのか
- Concept Spec、Scope Spec、Test Policy、DDL metadata、generated docs への影響
- 追加で必要になる検証方法

## Review Usage

`tech-rules.json` は、この文書の技術制約をAIとCLIが参照しやすくするための機械可読review indexである。

`tech-rules.json` は仕様本文の代替ではない。

## Source

- `packages/transfer/docs/technology/TECHNOLOGY_POLICY.md`
- `packages/transfer/docs/technology/tech-rules.json`
