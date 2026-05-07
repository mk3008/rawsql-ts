# Destination Link Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Destination Link の Concept Spec である。

Destination Link は、Transfer Setting が定義する転送元データソースを、特定の Destination へ接続する宛先別設定である。

この文書は、Destination Link の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- Destination Link とは、Transfer Setting のデータソースを特定の Destination へ接続する個別転送設定である。
- Transfer Setting は、複数の Destination Link を持ってよい。
- Destination Link は、同じ転送元データソースのスナップショットを複数 Destination へ一貫して流すための接続定義である。
- Destination Link は、どの Destination へ送るか、どの順序で送るか、転送元列を Destination 列へどう対応させるかを定義する。
- 同じ Destination が、同一 Transfer Setting から複数の Destination Link として参照されてもよい。
- 同じ Destination を複数回参照する場合、各 Destination Link は異なる役割、実行順、または mapping を持つ別の転送単位として扱う。

## Non-responsibilities

- Destination Link は、転送元データソースそのものを定義しない。
- Destination Link は、Destination の転送先テーブル仕様を定義しない。
- Destination Link は、Transfer Run の作成、スケジューリング、実行タイミングを管理しない。
- Destination Link は、転送実行状態や転送結果を管理しない。
- Destination Link は、Dirty Key の意味や登録方法を定義しない。
- Destination Link は、Active Black や Lineage の記録そのものではない。

## Responsibilities

- Destination Link は、接続先の Destination を示す。
- Destination Link は、Transfer Setting 内での宛先別の実行順を持ってよい。
- Destination Link は、宛先別の source-to-destination mapping を持つ。
- Destination Link は、宛先別の転送元キー定義を持ってよい。
- Destination Link は、宛先別の差分比較除外列を持ってよい。
- Destination Link は、AOT 生成された転送 SQL を保持してよい。

## Invariants

- Destination Link は、必ず1つの Transfer Setting に属する。
- Destination Link は、必ず1つの Destination を参照する。
- Destination Link は、Transfer Setting と Destination の組み合わせだけでなく、宛先別の役割や mapping を表す。
- 同じ Transfer Setting から同じ Destination へ複数の Destination Link を定義してもよい。
- 同じ Destination を複数回参照する Destination Link は、それぞれ独立した転送単位として扱う。
- Destination Link の mapping は、Transfer Setting の基礎 SQL の結果を Destination の列へ対応させるためのものであり、Destination の物理仕様を再定義しない。
- 生成済み転送 SQL を保持する場合、その所属先は Transfer Setting 単体でも Destination 単体でもなく、Destination Link である。

## Why

### Destination Link Connects One Data Source to One Destination Role

Transfer Setting は、転送元データソースを定義する。

Destination は、転送先テーブルへ書き込むために必要な転送先側の仕様を定義する。

Destination Link は、その間に立ち、同じデータソースをどの Destination のどの役割へ流すかを定義する。

これにより、1つのデータソースの同じスナップショットから、複数の Destination 行を一貫して生成できる。

### Same Destination May Be Referenced More Than Once

1つのデータソースから、同じ Destination に対して複数の行を生成したい場合がある。

この場合、Destination は同じでも、Destination Link ごとに役割、実行順、mapping が異なる。

そのため、同一 Transfer Setting 内で同じ Destination を複数 Destination Link として参照できる必要がある。

### Generated SQL Belongs to the Destination Link

AOT 生成された転送 SQL は、Transfer Setting 単体にも Destination 単体にも属さない。

転送 SQL は、Transfer Setting の基礎 SQL、Destination の列や transfer model、Destination Link の mapping や宛先別設定の組み合わせで決まる。

そのため、生成済み転送 SQL を保持する場合、その自然な所属先は Destination Link である。

保持する SQL の具体的な種類は実装 Issue で決める。たとえば Black Insert Transfer、Black Update Transfer、Red Transfer、Physical Delete Transfer など、転送表現ごとの SQL を保持することがある。

## Usage Notes

- Transfer Setting を読むときは、大きなデータソース定義と、そこから各 Destination へつなぐ Destination Link 群として見る。
- Destination Link は、単なる中間テーブルではなく、宛先別の転送単位である。
- 同じ Destination を複数 Destination Link として使う場合は、Destination Link ごとの役割や mapping によって区別する。
- 生成済み転送 SQL は、転送モード変更や再生成の都合を考えると、複数の転送表現に対応する候補を保持してよい。ただし、この文書では保持列や生成手順までは定義しない。
