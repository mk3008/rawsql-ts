# Red Transfer Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Red Transfer の Concept Spec である。

Red Transfer は、`immutable transfer model` で訂正や取消を表現するために、既に転送されている黒伝を反転した転送先行を追加する概念である。

この文書は、Red Transfer の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- 黒伝とは、転送元データをそのまま転送先へ流した転送先行である。
- 赤伝とは、黒伝を反転して訂正や取消を表現する転送先行である。
- Red Transfer とは、`immutable transfer model` で、既に転送されている黒伝を反転した赤伝を追加することである。
- Red Transfer は、`mutable transfer model` では発生しない。
- Red Transfer は、赤伝対象となる `Active Black` を必要とする。
- Red Transfer は、数量や金額など、少なくとも1つの符号反転対象を必要とする。
- Red Transfer が成功すると、反転対象だった `Active Black` は存在しなくなる。
- Red Transfer が成功すると、反転対象だった既存の転送先行と、生成された赤伝の `Lineage` が作成される。

## Non-responsibilities

- Red Transfer は、`mutable transfer model` の取消表現を定義しない。
- Red Transfer は、転送対象行を決定しない。
- 転送対象かどうかは、`Work Item` の文脈で判断する。
- Red Transfer は、`Active Black` の保存形式を定義しない。
- Red Transfer は、`Lineage` の保存形式を定義しない。
- Red Transfer は、赤伝 SQL の生成手順や実行手順を定義しない。
- Red Transfer は、符号反転列、引き継ぎ列、列マッピングの具体的な計算手順を定義しない。

## Responsibilities

- Red Transfer は、`immutable transfer model` における訂正や取消の表現を説明する。
- Red Transfer は、反転対象となる黒伝を必要とする。
- Red Transfer は、黒伝から赤伝を作るために、少なくとも1つの符号反転対象を必要とする。
- Red Transfer は、成功時に反転対象だった `Active Black` をなくす。
- Red Transfer は、赤伝が黒伝の反転として扱われることを説明する。
- Red Transfer は、成功時に赤伝の由来を `Lineage` として追跡できるようにする。

## Invariants

- Red Transfer は `immutable transfer model` でのみ発生する。
- `mutable transfer model` では、取消は Red Transfer ではなく `Physical Delete Transfer` で表現する。
- Red Transfer は、反転対象となる `Active Black` が存在する場合にだけ成立する。
- Red Transfer は、少なくとも1つの符号反転対象がある場合にだけ成立する。
- Red Transfer の成功後、反転対象だった黒伝は `Active Black` ではなくなる。
- Red Transfer の成功後、生成された赤伝は反転対象だった既存の転送先行を転送元とする `Lineage` を持つ。
- Red Transfer は、元の黒伝を物理削除しない。
- Red Transfer は、黒伝と赤伝の履歴を積み増すことで訂正や取消を表現する。

## Why

### Red Transfer Is Immutable-Only

`immutable transfer model` では、転送先行を直接更新または物理削除しない。

訂正や取消が必要になった場合、既に転送されている黒伝を反転した赤伝を追加する。

この積み増しにより、転送先行の履歴を残したまま訂正や取消を表現できる。

`mutable transfer model` では、転送先行を直接更新または `Physical Delete Transfer` で削除する。

そのため、`mutable transfer model` では Red Transfer は発生しない。

### Red Transfer Needs Active Black

赤伝は、反転対象となる黒伝がなければ作れない。

Red Transfer は、`Active Black` を参照して、どの黒伝を反転対象にするかを決める。

Red Transfer が成功した後、その黒伝は既に取り消された状態になるため、`Active Black` ではなくなる。

Red Transfer が成功した場合、生成された赤伝は反転対象だった既存の転送先行を転送元として追跡できる必要がある。

### Red Transfer Needs Sign-Reversal Targets

赤伝は、黒伝を反転した転送先行である。

そのため、赤伝を作るには、数量や金額など、少なくとも1つの符号反転対象が必要である。

符号反転対象がない場合、黒伝を反転した赤伝として何を追加するのかが概念上成立しない。

赤伝は既に転送されている黒伝から作る。赤伝時に転送元行の現在値を参照して赤伝を作る概念ではない。

### Red Transfer Is Not the SQL Generation Rule

Red Transfer は、`immutable transfer model` における取消や訂正の概念である。

符号反転する列、引き継ぐ列、実際の SQL 生成手順は、この文書では定義しない。

それらは `Destination` の転送先仕様、`Transfer Setting` との接続、または後続の転送実装で扱う。

## Usage Notes

- Red Transfer は、`immutable transfer model` の訂正や取消を説明するために使う。
- Red Transfer は、`mutable transfer model` には適用しない。
- `mutable transfer model` で取消を表現する場合は、`Physical Delete Transfer` として扱う。
- Red Transfer には、数量や金額など、少なくとも1つの符号反転対象が必要である。
- Red Transfer が成功した場合、反転対象だった `Active Black` は存在しなくなる。
- Red Transfer が成功した場合、生成された赤伝は `Lineage` によって由来を追跡できる。
- Red Transfer の具体的な保存形式や SQL 生成手順は、この文書では定義しない。
