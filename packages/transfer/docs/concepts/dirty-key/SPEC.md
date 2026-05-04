# Dirty Key Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Dirty Key / Dirty Key Management の Concept Spec である。

Dirty Key は、転送元側の行に何らかの変更が起きた可能性を記録するための概念である。

この文書は、Dirty Key の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- ここで言う Key とは、発生元テーブル上の行、または転送元として再評価すべき単位を識別する情報である。複合キーにも対応する。
- Dirty とは、追加、更新、削除など何らかの理由により、転送対象として再評価されるべき可能性があることを示す。
- Dirty Key とは、変更が起きた可能性のある発生元行を識別する変更検知履歴である。
- Dirty Key Management とは、Dirty Key をイミュータブルな変更検知履歴として管理する仕組みである。
- Dirty Key は、転送対象を確定するものではない。

## Non-responsibilities

- Dirty Key は転送指示、転送状態、転送結果ではない。
- Dirty Key は、追加、更新、削除のどれが起きたかを確定する責務を持たない。
- Dirty Key は、転送済み、処理済み、重複、リネージュ、現在有効な黒を管理しない。

## Responsibilities

- Dirty Key Management は、転送アプリケーション全体で共有される変更検知の入口として扱う。
- Dirty Key Management は、発生元テーブルと行を識別できる情報を保持する。
- Dirty Key Management は、単一キーだけでなく複合キーに対応する。
- Dirty Key Management は、変更検知または登録の時点を説明できる時刻情報を持つ。
- ただし、その時刻情報を厳密なイベント順、登録確定順、処理順の保証として扱ってはならない。
- Dirty Key Management に同一キーを排除するユニーク制約は置かない。
- 変更検知、再通知、再評価のために、同じキーを何度追加してもよい。
- Dirty Key Management への登録方法はスコープ外である。CDC、DBトリガー、手動追加等、なんらかの方法で追加する仕組みは別途必要である。
- Dirty Key Management への登録は非同期、並列で実行されることを想定する。
- Dirty Key Management への登録は transfer 中も常に追加され続ける可能性を想定する。
- transfer は、Dirty Key 自体に転送進捗や処理結果を書き戻さない。Dirty Key Management はイミュータブルな変更検知履歴として扱う。
- transfer は Dirty Key Management を長時間ロックする設計をしてはならない。
- transfer は Dirty Key Management にあるシーケンスの大小を登録確定順、イベント順、処理順として扱ってはならない。

## Why

### Dirty Key Management に同一キーのユニーク制約を置かない理由

Dirty Key Management は変更検知履歴であり、現在状態テーブルではない。

同じキーに対して、複数回の変更検知、再通知、手動投入が発生してよい。

そのため、同一キーを排除するユニーク制約は置かない。

また、登録時に存在チェックを行わないことで、外部 producer が低コストに追記できる。

### Dirty Key Management が変更理由を問わない理由

Dirty Key Management は、元テーブル上のイベント種別を転送上の操作種別へ変換しない。

論理削除のように、元テーブル上は更新でも、データソースクエリから取得されなくなることで転送上は削除相当になる場合がある。

そのため、変更理由が分かったとしても、Dirty Key Management はそれを転送判断の正本として扱わない。

Dirty Key Management が表すのは、何らかの変更により、そのキーを再評価すべき可能性がある、ということだけである。

## Usage Notes

- 追加、更新、削除どの転送をすべきかは、Dirty Key Management ではなく利用側が判断する。
- Dirty Key が転送済みか、処理済みかは、Dirty Key Management ではなく利用側が判断する。
- Dirty Key Management は常に追加され続けるため、利用側は Dirty Key Management 自体を長時間ロックする設計にしてはならない。
- 処理対象の固定化が必要な場合は、Dirty Key Management とは別の責務として扱う。
