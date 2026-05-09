# Active Black Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Active Black の Concept Spec である。

Active Black は、転送済みの黒伝のうち、まだ取り消されていない現在有効な黒伝を示す概念である。

この文書は、Active Black の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- 黒伝とは、転送元データをそのまま転送先へ流した転送先行である。
- Active Black とは、転送済みの黒伝のうち、まだ取り消されていない現在有効な黒伝である。
- Active Black は、転送元行そのものではなく、転送済みの黒伝を指す。
- Active Black は、`Transfer Setting` と `Destination Link` の文脈で、`source key` に対する現在有効な黒伝を示す。
- Active Black は、既存の有効な黒伝を示し、二重転送防止、更新相当の転送、取消や訂正の判断材料として参照される。
- Active Black は、連携されていない転送元行には存在しない。
- Active Black は、連携済みであっても、既に取り消されている黒伝には存在しない。

## Non-responsibilities

- Active Black は、転送先行の由来追跡を管理しない。
- Active Black は、転送対象行を決定しない。
- Active Black は、転送依頼、転送実行、または転送処理状態を管理しない。
- Active Black は、`Red Transfer` の意味を定義しない。
- Active Black は、赤伝 SQL の生成手順や実行手順を定義しない。
- Active Black は、黒伝や赤伝の金額計算、符号反転列、列マッピングを定義しない。
- Active Black は、`mutable transfer model` の処理ログや監査ログではない。

## Responsibilities

- Active Black は、現在有効な黒伝を特定できるようにする。
- Active Black は、どの `Transfer Run` によって現在有効になった黒伝かを追跡できるようにしてよい。
- Active Black は、`immutable transfer model` の `Red Transfer` で反転対象として参照すべき黒伝を特定できるようにする。
- Active Black は、転送済みの黒伝がまだ有効かどうかを判断するための概念境界を提供する。
- Active Black は、黒伝が `Red Transfer` または `Physical Delete Transfer` によって取り消された後には存在しない状態を表現する。
- Active Black は、`Lineage` と併用される場合、反転対象となる転送先行を追跡しやすくする。

## Invariants

- Active Black は、転送済みの黒伝が存在する場合にだけ存在し得る。
- Active Black は、`Transfer Setting` と `Destination Link` の文脈における `source key` 単位で最大1つである。
- 連携されていない転送元行には Active Black は存在しない。
- 取り消し済みの黒伝には Active Black は存在しない。
- `immutable transfer model` では、`Red Transfer` が成功したタイミングで、反転対象だった黒伝は Active Black ではなくなる。
- `immutable transfer model` で赤伝後に新しい黒伝が追加された場合、その新しい黒伝が Active Black になる。
- `mutable transfer model` では、`Physical Delete Transfer` が成功したタイミングで、対応する黒伝は Active Black ではなくなる。
- Active Black は、現在有効な黒伝を示す別軸の概念である。

## Why

### Black and Red Are Required Background

Active Black を理解するには、黒伝と赤伝の区別が必要である。

黒伝は、転送元データをそのまま転送先へ流した転送先行である。

赤伝は、転送元と転送先に値不一致、訂正、取消が発生したときに、`immutable transfer model` で訂正するための表現である。具体的には、既に転送されている黒伝を反転した行を追加する。

これは簿記における逆仕訳に近い考え方である。

この文書では黒伝と赤伝を前提知識として説明する。`Red Transfer` の概念境界は `Red Transfer` Concept Spec で扱う。

### Red Transfer Needs Active Black

`immutable transfer model` で `Red Transfer` を行うには、どの黒伝を反転するかを特定する必要がある。

Active Black は、その反転対象として参照すべき黒伝を示す。

同じ `Transfer Setting` `source key` から複数の `Destination Link` へ転送する場合、Active Black は `Destination Link` の文脈ごとに区別する。

連携されていない転送元行には、反転対象となる転送済みの黒伝が存在しない。そのため Active Black も存在しない。

連携済みであっても、その黒伝が既に `Red Transfer` または `Physical Delete Transfer` で取り消されている場合、参照すべき現在有効な黒伝は存在しない。そのため Active Black も存在しない。

### Active Black Is Related to Lineage but Separate

`Lineage` は、`immutable transfer model` における転送先行の由来追跡である。

Active Black は、現在有効な黒伝を示す。

両者は併用されることがあるが、役割は異なる。Active Black は現在有効な黒伝の特定に関する別軸の概念として扱う。

### Transfer Model Changes When Active Black Disappears

`immutable transfer model` では、転送先行を直接更新または物理削除せず、`Red Transfer` によって取消を表現する。

そのため、`Red Transfer` が成功したタイミングで、反転対象だった黒伝は Active Black ではなくなる。

`mutable transfer model` では、`Physical Delete Transfer` によって取消を表現する。

そのため、`Physical Delete Transfer` が成功したタイミングで、対応する黒伝は Active Black ではなくなる。

どちらの transfer model でも、取消処理が成功した後には、対象だった Active Black は存在しなくなる。

## Usage Notes

- Active Black は、現在有効な黒伝を説明するために使う。
- `immutable transfer model` では、`Red Transfer` の反転対象を説明するために使う。
- Active Black は、`Destination` 単体ではなく `Destination Link` の文脈で区別する。
- Active Black は、すべての転送履歴を説明するための概念ではない。
- Active Black が存在しないことは、未連携、`Red Transfer` 済み、または `Physical Delete Transfer` 済みである可能性を示す。
- 次にどの転送処理を実行するかは、`Work Item` や `Transfer Execution` の文脈で Active Black と他の判断材料を組み合わせて決定する。
- 黒伝、赤伝、Active Black の具体的な保存形式は、この文書では定義しない。
