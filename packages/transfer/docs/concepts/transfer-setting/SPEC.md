# Transfer Setting Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Transfer Setting の Concept Spec である。

Transfer Setting は、転送元データソースを定義し、そのデータソースをどの `Destination` へ接続するかを管理する概念である。

この文書は、Transfer Setting の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- Transfer Setting とは、転送元データソースを表す設定である。
- Transfer Setting は、名前で一意に特定できる。
- 転送元データソースは、物理テーブルに基づいてもよいし、クエリに基づいてもよい。
- `source key` とは、転送元データソースの論理行または再評価単位を識別するキーである。キーは単一キーでも複合キーでもよい。
- Transfer Setting は `source key` の定義を持つ。
- 転送元データソースは、`Destination` の採番式を使って `destination row key` を投影してよい。
- Transfer Setting は、`Destination Link` を通じて `Destination` へ接続される。
- `Destination Link` とは、Transfer Setting のデータソースを特定の `Destination` へ接続するための宛先別設定である。
- Transfer Setting は、転送ルールであり、転送実行そのものではない。

## Non-responsibilities

- Transfer Setting は変更検知履歴を管理しない。
- Transfer Setting は変更検知履歴の登録方法を定義しない。
- Transfer Setting は `Transfer Run` の作成、スケジューリング、実行タイミングを管理しない。
- Transfer Setting は転送実行状態を管理しない。
- Transfer Setting は転送履歴を管理しない。
- Transfer Setting は赤伝時に参照すべき現在有効な黒を管理しない。
- Transfer Setting は転送先テーブルの保存モデルを定義しない。
- Transfer Setting は、transfer engine が基礎 SQL に列や採番式を暗黙に追加することを前提にしない。

## Responsibilities

- Transfer Setting は、転送元データソースを抽出する基礎 SQL を持つ。
- Transfer Setting は、転送元データソースの論理行または再評価単位を特定する `source key` 定義を持つ。
- Transfer Setting は、`Destination` の採番式または自然キーを使って、転送先行を識別するための値を基礎 SQL に含めてよい。
- Transfer Setting は、基礎 SQL をどの `Destination` へ接続するかを `Destination Link` として管理する。
- `Destination Link` は、宛先ごとの実行順、source-to-destination mapping、生成済み転送 SQL、差分比較除外列を持ってよい。

## Invariants

- Transfer Setting の基礎 SQL は、転送元データソースの正本である。
- Transfer Setting の名前は、同じ package 内で一意であり、アプリケーションや後続処理から参照できる必要がある。
- Transfer Setting の `source key` 定義は、後続の転送処理が同じ転送元データを識別し、二重転送を防止する判断材料として参照できる必要がある。
- Transfer Setting の基礎 SQL は、転送先行を識別するために `Destination` の採番式または自然キーを使ってよい。
- transfer engine は、Transfer Setting の基礎 SQL に `destination row key`、採番式、検索条件、転送先列を暗黙に追加しない。
- Transfer Setting の基礎 SQL は、転送先への INSERT / UPDATE / DELETE そのものではない。
- 任意検索条件は、基礎 SQL の [SSSQL](/guide/sssql-overview) として表現する。転送 SQL 生成側が WHERE 条件を暗黙に追加しない。
- Transfer Setting と `Destination` の接続は、`Destination Link` として管理する。
- 生成済み転送 SQL は、Transfer Setting 単体ではなく、`Destination Link` 単位で管理する。

## Why

### Transfer Setting Represents a Data Source

Transfer Setting は、転送先ではなく転送元データソースを定義する。

転送元データソースは、物理テーブルをそのまま表してもよいし、複数テーブルや条件を含むクエリとして表してもよい。

転送元データソースは、後続の転送処理が同じ転送元データを識別できるように `source key` 定義を持つ。

`source key` は、転送元データソースの論理行または再評価単位を識別するキーである。これは物理テーブルの主キーそのものとは限らない。

これは Transfer Setting が転送指示、転送処理、転送結果を管理するという意味ではなく、定義として二重転送防止の判断材料を提供するという意味である。

単一テーブルを転送元データソースにする場合、`source key` はそのテーブルの主キーになることが多い。

集計クエリや選択クエリを転送元データソースにする場合、`source key` は集計単位や再評価単位を識別する自然キーになる。

転送元データソースは、転送先行を識別するための値も含めてよい。たとえば `Destination` が持つ採番式を基礎 SQL 内で使い、`Destination Link` ごとの `destination row key` を投影してよい。

ただし、transfer engine は基礎 SQL を受け取って転送するだけであり、基礎 SQL に採番列や転送先列を暗黙に組み込まない。必要な値は Transfer Setting の基礎 SQL と `Destination Link` の mapping で明示する。

複数の `Destination` へ同じデータソースを流す場合でも、データソース定義は Transfer Setting 側に1つ置き、宛先ごとの差分は `Destination Link` 側に置く。

### Destination Link Connects a Data Source to a Destination

`Destination Link` は、Transfer Setting のデータソースを特定の `Destination` へ接続するための宛先別設定である。

このリンクは単なる中間テーブルではない。ただし、`Transfer Run`、`Transfer Execution`、実行状態、実行履歴そのものでもない。

`Destination Link` の詳細は、独立した Concept Spec で扱う。

## Usage Notes

- Transfer Setting を読むときは、大きなデータソース定義と、そこから各 `Destination` へつなぐ小さな `Destination Link` 群として見る。
- `Destination` の列、キー、採番式、transfer model は `Destination` 側の仕様として扱う。
- `Destination Link` は、Transfer Setting と `Destination` の接続に必要な宛先別の mapping や `destination row key` の対応を扱う。
- Transfer Setting は実行タイミングを管理しない。いつ実行するか、どの `Transfer Run` として実行するかは別概念で扱う。
- Transfer Setting の基礎 SQL に任意検索条件が必要な場合は、SSSQL として明示する。
