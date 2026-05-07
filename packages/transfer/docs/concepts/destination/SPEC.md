# Destination Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Destination / Destination Definition の Concept Spec である。

Destination は、転送アプリケーションが転送先テーブルへ書き込むために参照する転送先仕様である。

この文書は、Destination の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- Destination とは、転送先テーブルへ書き込むために必要なテーブル、列、キー、採番、転送モデル、赤伝生成に関する転送先側の仕様である。
- Destination Definition とは、Destination を名前で再利用できるように永続化した定義である。
- Destination は、スキーマ名などを含む完全修飾された転送先テーブル名で一意に特定できる。
- Destination は、Transfer Setting から独立した転送先仕様である。
- Destination は、Transfer Setting ごとに再定義しない。
- Destination は、複数の Transfer Setting から参照されてよい。
- Destination は、転送先テーブルの物理 DDL そのものではない。転送アプリケーションが必要とする転送先仕様である。

## Non-responsibilities

- Destination は、転送元 SQL の列名、構造、抽出条件を定義しない。
- Destination は、source-to-destination mapping を定義しない。
- source-to-destination mapping は、Destination Link の文脈で扱う。
- Destination は、Transfer Setting ごとの実行順序や有効無効を定義しない。
- Destination は、転送実行状態、転送結果、実行履歴を管理しない。
- Destination は、転送先行の由来追跡や、赤伝時に参照すべき現在有効な黒を管理しない。
- Destination は、SQL 生成手順や SQL 実行手順を定義しない。
- Destination は、Transfer Setting ごとの差分比較除外列を定義しない。
- Destination は、Transfer Setting の都合で転送先テーブル、キー、採番、transfer model の意味を変えない。

## Responsibilities

- Destination は、スキーマ名などを含む完全修飾された転送先テーブル名を持つ。
- Destination は、転送先テーブルへ書き込む列を識別できる情報を持つ。
- Destination は、転送先行を後から識別できるキー定義を持つ。
- Destination は、転送先行を新規作成する際に、転送先側で採番値を得るための式または規則を持ってよい。
- Destination は、転送先の保存モデルとして transfer model を示す。
- Destination は、赤伝生成に必要な転送先側の列情報を持ってよい。
- Destination が immutable transfer model で Red Transfer を扱う場合、数量や金額など、少なくとも1つの符号反転列を識別できる必要がある。

## Invariants

- Destination は、転送先の保存モデルを表す。
- Destination は、転送元ごとに作らない。
- Destination の転送先テーブル名は、同じ package 内で一意であり、同じ物理転送先テーブルを複数の Destination Definition として再定義しない。
- Destination は、Transfer Setting から再利用されてよい。
- Destination は、Transfer Setting に依存してはならない。
- Transfer Setting は、Destination を参照してよいが、Destination の意味を上書きしてはならない。
- Destination の transfer model は、後続の転送 SQL 生成と転送実行の前提になる。
- immutable transfer model の Destination は、Red Transfer のために少なくとも1つの符号反転列を識別できる必要がある。
- Destination のキー定義は、転送先行を後から参照できる必要がある。
- Destination の採番式は、転送元 SQL に書かない。転送先定義側で管理する。
- Destination は、転送先テーブルの物理 DDL そのものではない。

## Why

### Destination Has Transfer Model

Destination は、transfer model を持つ。

```yaml
transfer_model:
  - immutable
  - mutable
```

### immutable

`immutable` は、転送先行を直接更新・削除せず、履歴として積み増す転送モデルである。

更新時は、元黒を赤伝化し、新黒を追加する。
削除時は、元黒を赤伝化する。

ただし、この文書では具体的な SQL 生成手順や実行手順は定義しない。

### mutable

`mutable` は、転送先行を直接更新・削除する転送モデルである。

更新時は、転送先行を直接更新する。
削除時は、転送先行を物理削除する。

ただし、この文書では具体的な SQL 生成手順や実行手順は定義しない。

### Transfer Model Changes Are Migration-Level Decisions

Destination の `transfer_model` は、軽い表示設定ではなく、転送先行をどう保存し、どう取り消し、どう更新するかを決める保存モデルである。

そのため、既に転送が行われた Destination の `transfer_model` を変更する場合は、通常の編集ではなく migration-level decision として扱う。

変更は許可してよい。ただし、編集時バリデーションでは警告対象にする。

`mutable` から `immutable` へ変更する場合、変更前の転送には Lineage が不足する可能性がある。現在の Active Black を移行時点の黒伝として扱える場合でも、変更前の履歴が完全に復元されるわけではない。

`immutable` から `mutable` へ変更する場合、既存の黒伝、赤伝、Lineage は残ってよい。Destination は transfer 専用のシステムテーブルではなく、transfer 以外の producer が行を追加または変更する可能性もあるため、過去行が Destination 上に残ること自体は Concept Spec 違反ではない。

ただし、`mutable` へ変更した後の転送処理は、Active Black を直接 UPDATE または Physical Delete Transfer の対象として扱う。既存 Lineage は過去の転送記録として残るが、変更後の mutable 運用全体を完全に表す履歴ではない。

`immutable -> mutable -> immutable` のように再変更する場合、現在の Active Black が過去の Lineage に既に記録されていることがある。これは migration history として扱うべき注意点であり、Lineage や Active Black の Concept Spec 違反ではない。

編集時バリデーションは、`transfer_model` の変更を禁止するためではなく、履歴解釈、Lineage の不完全性、Active Black の扱いが変わることを人間に警告するために行う。

### Destination Owns Red Transfer Column Information

Destination は、赤伝生成に必要な転送先側の列情報を持ってよい。

たとえば、赤伝生成時に符号反転する列や、元黒から赤伝へ引き継ぐ列を示してよい。

Red Transfer を成立させるには、数量や金額など、少なくとも1つの符号反転列が必要である。

赤伝は既に転送されている元黒から作るため、符号反転列は転送先側の黒伝をどう反転するかを示す情報である。

これは赤伝を生成するための転送先側の仕様であり、具体的な SQL 生成手順や実行手順ではない。

### Destination Has Destination Columns

Destination は、転送先テーブルへ書き込む列を識別できる必要がある。

Destination の転送先テーブル名は、スキーマ名などを含む完全修飾名として扱う。
たとえば `public.journal` のように、同じ package 内で一意に転送先テーブルを特定できる名前を使う。

同じ物理転送先テーブルに対して複数の Destination Definition を作ると、transfer model、キー定義、採番式、赤伝列情報の正本が分裂する。
そのため、Destination は転送先テーブル名でも一意に特定できる必要がある。

転送先テーブルの物理 DDL を毎回参照して列情報を取得することもできるが、Destination Definition は転送アプリケーションが必要とする転送先仕様を明示的に保持する。

### Destination Has Key Definition

Destination は、転送先行を後から参照できる必要がある。

キーはサロゲートキー、自然キー、複合キーを取り得る。

サマリ転送のような場合、複合キーが自然なこともある。

### Destination Has Sequence Expression

Destination は、転送先行を新規作成する際に、転送先側で採番値を得るための式または規則を持ってよい。

採番式は転送先仕様であり、転送元 SQL に書かない。

### Destination Is Independent From Transfer Setting

Destination は複数の Transfer Setting から使われる可能性がある。

たとえば `journal` や `account_balance` のような転送先は、売上転送、未収入金転送、入金転送など、複数の Transfer Setting から参照されてよい。

そのため、Destination は Transfer Setting の子概念ではなく、独立した概念として扱う。

## Usage Notes

- Transfer Setting は、参照する Destination の転送先仕様に合わせて mapping や source SQL を設計する。
- Transfer Setting は Destination を参照してよいが、Destination の意味を上書きしない。
- Transfer Setting ごとの実行順序、有効無効、差分比較除外列は Destination ではなく Destination Link の責務として扱う。
- Destination の transfer model や赤伝列情報は、後続の SQL 生成や転送実行の前提として扱う。
- `transfer_model` の変更は許可してよいが、編集時には migration-level decision として警告する。
