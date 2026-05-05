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
- Transfer Setting Destination Link とは、Transfer Setting のデータソースを特定の Destination へ接続するための宛先別設定である。
- Transfer Setting は、転送ルールであり、転送実行リクエストそのものではない。

## Non-responsibilities

- Transfer Setting は Dirty Key を管理しない。
- Transfer Setting は Dirty Key の登録方法を定義しない。
- Transfer Setting は Transfer Request の作成、スケジューリング、実行タイミングを管理しない。
- Transfer Setting は転送実行状態を管理しない。
- Transfer Setting は転送履歴を管理しない。
- Transfer Setting は active black を管理しない。
- Transfer Setting は転送先テーブルの保存モデルを定義しない。
- Transfer Setting は Destination の意味を再定義しない。

## Responsibilities

- Transfer Setting は、転送元データソースを抽出する基礎 SQL を持つ。
- Transfer Setting は、転送元データソースの行または再評価単位を特定するキー定義を持つ。
- Transfer Setting は、基礎 SQL をどの Destination へ接続するかを Destination Link として管理する。
- Destination Link は、宛先ごとの実行順を持ってよい。
- Destination Link は、宛先ごとの転送元キー定義を持ってよい。
- Destination Link は、宛先ごとの source-to-destination mapping を持ってよい。
- Destination Link は、宛先ごとの生成済み転送 SQL を保持してよい。
- Destination Link は、宛先ごとの差分比較除外列を持ってよい。

## Invariants

- Transfer Setting の基礎 SQL は、転送元データソースの正本である。
- Transfer Setting の名前は、同じ package 内で一意であり、アプリケーションや後続処理から参照できる必要がある。
- Transfer Setting のキー定義は、後続の転送処理が同じ転送元データを識別し、二重転送を防止する判断材料として参照できる必要がある。
- Transfer Setting の基礎 SQL は、転送先の採番式を持たない。
- Transfer Setting の基礎 SQL は、転送先への INSERT / UPDATE / DELETE そのものではない。
- 任意検索条件は、基礎 SQL の [SSSQL](../../../../../docs/guide/sssql-overview.md) として表現する。転送 SQL 生成側が WHERE 条件を暗黙に追加しない。
- Transfer Setting と Destination の接続は、Transfer Setting Destination Link として管理する。
- 生成済み転送 SQL は、Transfer Setting 単体ではなく、Transfer Setting Destination Link 単位で管理する。
- Transfer Setting は、Dirty Key の意味を再定義しない。
- Transfer Setting は、Destination の意味を再定義しない。

## Why

### Transfer Setting Represents a Data Source

Transfer Setting は、転送先ではなく転送元データソースを定義する。

転送元データソースは、物理テーブルをそのまま表してもよいし、複数テーブルや条件を含むクエリとして表してもよい。

転送元データソースは、後続の転送処理が同じ転送元データを識別できるようにキー定義を持つ。これは Transfer Setting が転送指示、転送処理、転送結果を管理するという意味ではなく、定義として二重転送防止の判断材料を提供するという意味である。

複数の Destination へ同じデータソースを流す場合でも、データソース定義は Transfer Setting 側に1つ置き、宛先ごとの差分は Destination Link 側に置く。

### Destination Link Connects a Data Source to a Destination

Transfer Setting Destination Link は、Transfer Setting のデータソースを特定の Destination へ接続するための宛先別設定である。

このリンクは、以下を表す。

- どの Destination へ接続するか
- どの順序で扱うか
- 転送元キーをどう特定するか
- 転送元 SQL の結果を Destination 列へどう mapping するか
- 宛先ごとの差分比較除外列をどう扱うか
- 生成済み転送 SQL をどこに保持するか

このリンクは単なる中間テーブルではない。ただし、Transfer Request、Transfer Execution、実行状態、実行履歴そのものでもない。

### Generated SQL Belongs to the Link

生成済み転送 SQL は、Transfer Setting 単体にも、Destination 単体にも属さない。

生成済み転送 SQL は、以下の組み合わせで決まる。

- Transfer Setting の基礎 SQL
- Destination の列、キー、採番式、transfer model
- Transfer Setting Destination Link が持つキー定義、mapping 定義、宛先別設定

そのため、生成済み転送 SQL は Transfer Setting Destination Link 単位で管理する。

## Usage Notes

- Transfer Setting を読むときは、大きなデータソース定義と、そこから各 Destination へつなぐ小さな Destination Link 群として見る。
- Destination の列、キー、採番式、transfer model は Destination 側の仕様として扱う。
- Destination Link は、Transfer Setting と Destination の接続に必要な宛先別の mapping やキー定義を扱う。
- Transfer Setting は実行タイミングを管理しない。いつ実行するか、どのリクエストとして実行するかは別概念で扱う。
- Transfer Setting の基礎 SQL に任意検索条件が必要な場合は、SSSQL として明示する。

## Related Terms

この文書では、以下の関連概念を定義しない。

- Destination
- Dirty Key
- Transfer Request
- Transfer Execution
- lineage
- active black
