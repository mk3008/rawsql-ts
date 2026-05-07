# Transfer Setting Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Transfer Setting の Concept Spec である。

Transfer Setting は、転送元データソースを定義し、そのデータソースをどの Destination へ接続するかを管理する概念である。

この文書は、Transfer Setting の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- Transfer Setting とは、転送元データソースを表す設定である。
- Transfer Setting は、名前で一意に特定できる。
- 転送元データソースは、物理テーブルに基づいてもよいし、クエリに基づいてもよい。
- 転送元データソースは、転送元の行または再評価単位を特定するキー定義を持つ。キーは単一キーでも複合キーでもよい。
- Transfer Setting は、Destination Link を通じて Destination へ接続される。
- Destination Link とは、Transfer Setting のデータソースを特定の Destination へ接続するための宛先別設定である。
- Transfer Setting は、転送ルールであり、転送実行そのものではない。

## Non-responsibilities

- Transfer Setting は変更検知履歴を管理しない。
- Transfer Setting は変更検知履歴の登録方法を定義しない。
- Transfer Setting は Transfer Run の作成、スケジューリング、実行タイミングを管理しない。
- Transfer Setting は転送実行状態を管理しない。
- Transfer Setting は転送履歴を管理しない。
- Transfer Setting は赤伝時に参照すべき現在有効な黒を管理しない。
- Transfer Setting は転送先テーブルの保存モデルを定義しない。

## Responsibilities

- Transfer Setting は、転送元データソースを抽出する基礎 SQL を持つ。
- Transfer Setting は、転送元データソースの行または再評価単位を特定するキー定義を持つ。
- Transfer Setting は、基礎 SQL をどの Destination へ接続するかを Destination Link として管理する。
- Destination Link は、宛先ごとの実行順、キー定義、mapping、生成済み転送 SQL、差分比較除外列を持ってよい。

## Invariants

- Transfer Setting の基礎 SQL は、転送元データソースの正本である。
- Transfer Setting の名前は、同じ package 内で一意であり、アプリケーションや後続処理から参照できる必要がある。
- Transfer Setting のキー定義は、後続の転送処理が同じ転送元データを識別し、二重転送を防止する判断材料として参照できる必要がある。
- Transfer Setting の基礎 SQL は、転送先の採番式を持たない。
- Transfer Setting の基礎 SQL は、転送先への INSERT / UPDATE / DELETE そのものではない。
- 任意検索条件は、基礎 SQL の [SSSQL](../../../../../docs/guide/sssql-overview.md) として表現する。転送 SQL 生成側が WHERE 条件を暗黙に追加しない。
- Transfer Setting と Destination の接続は、Destination Link として管理する。
- 生成済み転送 SQL は、Transfer Setting 単体ではなく、Destination Link 単位で管理する。

## Why

### Transfer Setting Represents a Data Source

Transfer Setting は、転送先ではなく転送元データソースを定義する。

転送元データソースは、物理テーブルをそのまま表してもよいし、複数テーブルや条件を含むクエリとして表してもよい。

転送元データソースは、後続の転送処理が同じ転送元データを識別できるようにキー定義を持つ。これは Transfer Setting が転送指示、転送処理、転送結果を管理するという意味ではなく、定義として二重転送防止の判断材料を提供するという意味である。

複数の Destination へ同じデータソースを流す場合でも、データソース定義は Transfer Setting 側に1つ置き、宛先ごとの差分は Destination Link 側に置く。

### Destination Link Connects a Data Source to a Destination

Destination Link は、Transfer Setting のデータソースを特定の Destination へ接続するための宛先別設定である。

このリンクは単なる中間テーブルではない。ただし、Transfer Run、Transfer Execution、実行状態、実行履歴そのものでもない。

Destination Link の詳細は、独立した Concept Spec で扱う。

## Usage Notes

- Transfer Setting を読むときは、大きなデータソース定義と、そこから各 Destination へつなぐ小さな Destination Link 群として見る。
- Destination の列、キー、採番式、transfer model は Destination 側の仕様として扱う。
- Destination Link は、Transfer Setting と Destination の接続に必要な宛先別の mapping やキー定義を扱う。
- Transfer Setting は実行タイミングを管理しない。いつ実行するか、どの Transfer Run として実行するかは別概念で扱う。
- Transfer Setting の基礎 SQL に任意検索条件が必要な場合は、SSSQL として明示する。
