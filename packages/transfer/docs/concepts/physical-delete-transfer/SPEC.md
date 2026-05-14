# Physical Delete Transfer Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Physical Delete Transfer の Concept Spec である。

Physical Delete Transfer は、`mutable transfer model` において、既存の転送先行を物理削除する削除表現である。

この文書は、Physical Delete Transfer の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- Physical Delete Transfer とは、`mutable transfer model` で既存の転送先行を物理削除する転送表現である。
- Physical Delete Transfer は、転送元の現在値が存在せず、既存の `Active Black` が存在する場合に使われる。
- Physical Delete Transfer は、`Black Transfer` ではない。
- Physical Delete Transfer は、`Red Transfer` ではない。
- `mutable transfer model` の削除相当は、Physical Delete Transfer として表現する。
- Physical Delete Transfer が成功すると、削除対象だった `Active Black` は存在しなくなる。

## Non-responsibilities

- Physical Delete Transfer は、`immutable transfer model` の削除表現を定義しない。
- `immutable transfer model` の削除相当は、`Red Transfer` の文脈で扱う。
- Physical Delete Transfer は、転送対象行を決定しない。
- 転送対象かどうかは、`Work Item` の文脈で判断する。
- Physical Delete Transfer は、`Active Black` の保存形式を定義しない。
- Physical Delete Transfer は、`Lineage` を作成しない。
- Physical Delete Transfer は、削除 SQL の生成手順や実行手順を定義しない。

## Responsibilities

- Physical Delete Transfer は、`mutable transfer model` における削除相当の表現を説明する。
- Physical Delete Transfer は、削除対象となる既存の `Active Black` を必要とする。
- Physical Delete Transfer は、`Active Black` に対応する既存の転送先行を物理削除する。
- Physical Delete Transfer は、成功時に削除対象だった `Active Black` をなくす。

## Invariants

- Physical Delete Transfer は `mutable transfer model` でのみ発生する。
- `immutable transfer model` では、削除相当は Physical Delete Transfer ではなく `Red Transfer` として表現する。
- Physical Delete Transfer は、転送元の現在値が存在せず、`Active Black` が存在する場合に成立する。
- Physical Delete Transfer は、黒伝を追加しない。
- Physical Delete Transfer は、赤伝を追加しない。
- Physical Delete Transfer は、転送先行を物理削除する。
- Physical Delete Transfer の成功後、削除対象だった黒伝は `Active Black` ではなくなる。
- Physical Delete Transfer は `Lineage` を作成しない。

## Why

### Mutable Delete Is Not Black or Red

`Black Transfer` は、転送元の現在値を転送先へ反映する転送表現である。

`Red Transfer` は、`immutable transfer model` で既存黒伝を反転した赤伝を追加する削除または訂正表現である。

`mutable transfer model` の削除相当は、転送元の現在値を反映するものでも、赤伝を追加するものでもない。

そのため、`mutable transfer model` で既存の転送先行を物理削除する表現を Physical Delete Transfer として分ける。

### Physical Delete Removes Active Black

Physical Delete Transfer は、削除対象となる既存の `Active Black` を必要とする。

Physical Delete Transfer が成功すると、対応する転送先行は物理削除される。

そのため、削除対象だった黒伝は `Active Black` ではなくなる。

## Usage Notes

- Physical Delete Transfer は、`mutable transfer model` の削除相当を説明するために使う。
- `immutable transfer model` の削除相当は `Red Transfer` として説明する。
- Physical Delete Transfer は、黒伝を追加または更新しない。
- Physical Delete Transfer は、赤伝を追加しない。
- Physical Delete Transfer の処理結果は、`Dirty Key Processing` に記録されてよい。
- Physical Delete Transfer の具体的な保存形式や SQL 生成手順は、この文書では定義しない。
