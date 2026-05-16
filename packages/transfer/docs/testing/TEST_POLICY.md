# Transfer Package Test Policy

この文書は `@rawsql-ts/transfer` の package-level verification harness である。

これは Concept Spec ではない。個別概念の意味、責務、非責務、不変条件は `docs/concepts/` 配下の Concept Spec に置く。

この文書は、AIや人間が transfer の変更をレビューするときに、毎回推論し直さず参照できる検証方針を定義する。

## Purpose

`@rawsql-ts/transfer` は、SQL、DDL、queryspec、generated mapper、ZTD-backed DB tests を組み合わせて検証する。

hot mapper path に runtime validation を追加することではなく、DB制約、queryspec contract、generated mapper drift check、DB-backed tests へ検証責務を左シフトする。

## In Scope

- DDL制約、型、CHECK、unique、index設計の検証
- queryspec contract と generated mapper の整合確認
- ZTD-backed SQL unit tests によるDBバインディング検証
- NULL、blank、空配列、空object、JSON shape、enum境界の検証
- source key / destination key の identity 境界検証
- generated SQL status、route、operation、processing result の状態境界検証
- hash がlookup補助でありidentity正本ではないことの検証

## Out of Scope

- 実装コードからAIが推論した decision table を正本として扱うこと
- E2EだけでSQL / mapper contract の検証を代替すること
- hot mapper path にruntime validationを入れることを標準戦略にすること
- external producer、CDC runtime、scheduler、host runtime の検証責務を transfer core に含めること

## Required Review Posture

テスト観点は、実装コードから逆算しない。

分岐表や状態遷移テストが必要な場合は、Issue、Concept Spec、DFD、Process Map、または明示されたdecision metadataを正本として扱う。

実装からAIが生成したテスト表は、実装をなぞるだけになりやすいため、要求検証の正本にはしない。

## Mapping Strategy

DB rows は任意のWeb入力とは異なる trust boundary にある。

mapperの安全性は、以下で担保する。

- DDL constraints
- queryspec contracts
- generated mapper drift checks
- ZTD-backed DB tests

feature側でDB resultをZodなどで再validationする場合は、なぜ上記では不足するのかをレビューで説明する。

## Boundary Cases

transfer の変更では、少なくとも以下の境界を意識する。

- `null`
- blank string
- empty array
- empty object
- JSON object / array のshape
- enum allowed values and unknown values
- duplicate source key / destination key
- source key hash collision candidates
- generated SQL status transitions
- processing result transitions

## Review Usage

`test-rules.json` は、この文書の検証方針をAIとCLIが参照しやすくするための機械可読review indexである。

`test-rules.json` は仕様本文の代替ではない。
