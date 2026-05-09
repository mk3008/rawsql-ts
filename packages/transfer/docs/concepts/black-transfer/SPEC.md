# Black Transfer Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Black Transfer の Concept Spec である。

Black Transfer は、転送元の現在値を転送先へコピーし、黒伝を作る転送表現である。

この文書は、Black Transfer の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- Black Transfer とは、転送元の現在値を転送先へコピーすることである。
- Black Transfer は、転送時点で参照した転送元データのスナップショットを転送先へ作る。
- 黒伝とは、Black Transfer によって作られた転送先行である。
- Black Insert Transfer とは、Black Transfer のうち、新しい黒伝を追加する転送表現である。
- Black Update Transfer とは、Black Transfer のうち、`mutable transfer model` で既存の黒伝を直接 UPDATE して現在値を反映する転送表現である。
- `immutable transfer model` では、Black Transfer は Black Insert Transfer として表現される。
- `mutable transfer model` では、Black Transfer は状況に応じて Black Insert Transfer または Black Update Transfer として表現される。
- Black Transfer は、同じ `Transfer Setting`、`Destination Link`、`source key` の文脈で、同じ転送元状態を二重転送しない。
- 二重転送かどうかは、既存の `Active Black` を参照して判断できる必要がある。
- Black Transfer が成功すると、作成または更新された黒伝は `Active Black` になる。
- `immutable transfer model` の Black Transfer が成功すると、`Active Black` に加えて `Lineage` も作成される。

## Non-responsibilities

- Black Transfer は、`Red Transfer` の意味を定義しない。
- Black Transfer は、取消や訂正を表現しない。
- Black Transfer は、転送対象行を決定しない。
- 転送対象かどうかは、`Work Item` の文脈で判断する。
- Black Transfer は、`Active Black` の保存形式を定義しない。
- Black Transfer は、`Lineage` の保存形式を定義しない。
- Black Transfer は、転送 SQL の生成手順や実行手順を定義しない。
- Black Transfer は、source-to-destination mapping の具体的な計算手順を定義しない。

## Responsibilities

- Black Transfer は、転送元の現在値を転送先へコピーする通常転送を説明する。
- Black Transfer は、転送先に黒伝を追加または更新する。
- Black Transfer は、Black Insert Transfer と Black Update Transfer の上位概念として扱う。
- Black Transfer は、二重転送を避けるために既存の `Active Black` を参照できる必要がある。
- Black Transfer は、成功時に作成または更新された黒伝を `Active Black` として扱えるようにする。
- Black Transfer は、`immutable transfer model` では成功時に `Lineage` を作成できるようにする。

## Invariants

- Black Transfer は、転送元の現在値を転送先へコピーする。
- Black Transfer は、取消や訂正のための反転行を作らない。
- `immutable transfer model` では、Black Transfer は Black Insert Transfer として黒伝を追加する。
- `mutable transfer model` では、`Active Black` がない場合は Black Insert Transfer として黒伝を追加する。
- `mutable transfer model` では、`Active Black` がある場合は Black Update Transfer として既存の黒伝を直接 UPDATE して現在値を反映する。
- Black Transfer は、同じ `Transfer Setting`、`Destination Link`、`source key` の文脈で、同じ転送元状態を二重転送しない。
- Black Transfer は、同じ `Transfer Setting`、`Destination Link`、`source key` の文脈における既存の `Active Black` を二重転送判断の材料として扱える必要がある。
- Black Transfer が成功した場合、対応する黒伝は `Active Black` になる。
- `immutable transfer model` では、Black Transfer の成功時に `Lineage` が作成される。
- `mutable transfer model` では、この文書で定義する `Lineage` は作成されない。

## Why

### Black Transfer Is the Normal Snapshot Transfer

Black Transfer は、転送元の現在値を転送先へコピーする。

これは、転送時点で参照した転送元データを転送先に残すスナップショットである。

ここでいうスナップショットは、転送時点で参照した値を転送先へ作るという意味であり、転送元の将来の現在値と一致し続けることを保証しない。

### Black Transfer Depends on Transfer Model

Black Transfer は、transfer model によって転送先への反映方法が変わる。

`immutable transfer model` では、転送先行を直接更新しない。

そのため、Black Transfer は Black Insert Transfer として新しい黒伝を追加する。

`mutable transfer model` では、転送先行を直接更新できる。

`Active Black` がない場合、Black Transfer は Black Insert Transfer として新しい黒伝を追加する。

既に対応する `Active Black` がある場合、Black Transfer は Black Update Transfer として既存の黒伝を直接 UPDATE して現在値を反映する。

### Black Transfer Must Avoid Duplicate Transfer

Black Transfer は、同じ `Transfer Setting`、`Destination Link`、`source key` の文脈で、同じ転送元状態を二重転送しない。

既に有効な黒伝が存在する場合、それは同じ `Transfer Setting`、`Destination Link`、`source key` の文脈における `Active Black` として参照できる必要がある。

`Active Black` は、Black Transfer が新しい黒伝を作るべきか、既に有効な黒伝があるかを判断する材料になる。

### Successful Black Transfer Creates Active Black

Black Transfer が成功すると、転送先に黒伝が存在する。

その黒伝がまだ取り消されていない場合、`Active Black` として扱われる。

`mutable transfer model` では、転送成功時に `Active Black` を記録できる必要がある。

`immutable transfer model` でも、転送成功時に `Active Black` を記録できる必要がある。

### Immutable Black Transfer Also Creates Lineage

`immutable transfer model` では、転送先行を履歴として積み増す。

そのため、Black Transfer が成功した場合、転送元データソースの論理行と黒伝の対応を `Lineage` として追跡できる必要がある。

`mutable transfer model` では、転送先行を直接更新または `Physical Delete Transfer` で削除するため、この文書で定義する `Lineage` は作成しない。

## Usage Notes

- Black Transfer は、通常の転送や新しい黒伝の追加を説明するために使う。
- `immutable transfer model` では、更新相当の転送は `Red Transfer` と Black Transfer の組み合わせで説明できる。
- `mutable transfer model` では、初回転送は Black Insert Transfer として説明できる。
- `mutable transfer model` では、既存の転送先行への現在値反映は Black Update Transfer として説明できる。
- Black Transfer は、取消や訂正のための反転行を作らない。
- Black Transfer の具体的な保存形式や SQL 生成手順は、この文書では定義しない。
