# Dirty Key Processing Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Dirty Key Processing の Concept Spec である。

Dirty Key Processing は、Dirty Key が特定の Transfer Setting と Destination Link の文脈で、どの Transfer Run によりどの転送判断として処理されたかを記録する概念である。

この文書は、Dirty Key Processing の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- Dirty Key Processing とは、処理済みの Dirty Key ID を記録する概念である。
- Dirty Key Processing は、どの Transfer Run で処理されたかを追跡できる。
- Dirty Key Processing は、どの Transfer Setting の文脈で処理されたかを追跡できる。
- Dirty Key Processing は、どの Destination Link の文脈で処理されたかを追跡できる。
- Dirty Key Processing は、転送先設定 ID を持つ必要がある。
- Dirty Key Processing は、Work Item の処理結果を記録できる。
- Dirty Key Processing は、二重転送防止のために参照される処理済み記録である。
- Dirty Key Processing は、Dirty Key Management そのものではない。

## Non-responsibilities

- Dirty Key Processing は、Dirty Key Management の変更検知履歴を変更しない。
- Dirty Key Processing は、Dirty Key 自体に処理済み状態を書き込まない。
- Dirty Key Processing は、Dirty Key の登録方法を定義しない。
- Dirty Key Processing は、Work Item の処理結果を作らない。
- Dirty Key Processing は、Black Transfer、Red Transfer、Active Black、Lineage の保存形式を定義しない。
- Dirty Key Processing は、転送 SQL の生成手順や実行手順を定義しない。

## Responsibilities

- Dirty Key Processing は、処理済みの Dirty Key ID を記録する。
- Dirty Key Processing は、処理した Transfer Run を記録する。
- Dirty Key Processing は、処理した Transfer Setting の文脈を記録する。
- Dirty Key Processing は、処理した Destination Link の文脈を記録する。
- Dirty Key Processing は、転送先設定 ID を記録する。
- Dirty Key Processing は、Work Item の処理結果を記録する。
- Dirty Key Processing は、追加、更新、赤伝追加、削除、無視など、Work Item がどう処理されたかを追跡できるようにする。
- Dirty Key Processing は、Work Item を作るときに、処理済み Dirty Key を除外できるようにする。
- Dirty Key Processing は、同じ Dirty Key を同じ Transfer Setting と Destination Link の文脈で二重転送しないための判断材料を提供する。
- Dirty Key Processing は、監査やデバッグで、Dirty Key がどう扱われたかを追跡できるようにする。

## Invariants

- Dirty Key Processing は、Dirty Key ID を記録する。
- Dirty Key Processing は、Transfer Run を記録する。
- Dirty Key Processing は、Destination Link または転送先設定 ID を記録する。
- Dirty Key Processing は、処理結果を記録する。
- Work Item を作るとき、既に Dirty Key Processing に記録されている Dirty Key は処理済みとして除外する。
- Work Item の処理が終わった後、Dirty Key Processing に Dirty Key ID、転送先設定 ID、処理結果、Transfer Run を記録する。
- Dirty Key 自体には処理済み状態を書き込まない。
- Dirty Key Processing の処理済み記録は、Transfer Setting と Destination Link の文脈を持つ。
- 同じ Dirty Key でも、Transfer Setting または Destination Link が異なれば別の Dirty Key Processing として扱われ得る。
- Dirty Key Processing は、処理済み記録であり、変更検知履歴ではない。

## Why

### Dirty Key Is Immutable Change Detection

Dirty Key Management は、変更検知履歴としてイミュータブルに扱う。

同じキーに対して複数の Dirty Key が追加されてよい。

そのため、どの Dirty Key が処理済みかを Dirty Key 自体に書き戻してはならない。

Dirty Key Processing は、Dirty Key とは別に処理済み記録を持つための概念である。

### Dirty Key Processing Prevents Duplicate Transfer

Work Item は Dirty Key から作られる。

しかし、既に処理済みの Dirty Key を再び Work Item として処理すると、二重転送につながる。

Work Item を作るときは、Dirty Key Processing に記録済みの Dirty Key を除外する必要がある。

この除外により、Dirty Key 自体を変更せずに二重転送を防止できる。

### Processing Is Destination Link Scoped

Dirty Key は転送アプリケーション全体で共有される変更検知履歴である。

同じ Dirty Key でも、Transfer Setting が異なれば処理対象や転送判断は異なり得る。

また、1つの Transfer Run は1つの Transfer Setting を対象にするが、その Transfer Setting は複数の Destination Link を持ち得る。

そのため、Dirty Key Processing は Transfer Setting だけでなく、Destination Link の文脈を持つ必要がある。

転送先設定 ID がないと、ある Dirty Key がどの転送先設定で処理済みなのかを区別できず、二重転送防止の粒度が粗くなる。

### Processing Records the Decision

Dirty Key Processing は、Dirty Key が処理済みかどうかだけでなく、Work Item がどの結果として処理されたかを追跡できる。

たとえば、無視した、Black Insert Transfer で追加した、Black Update Transfer で更新した、Red Transfer で赤伝を追加した、Red Transfer 後に Black Insert Transfer した、Physical Delete Transfer で物理削除した、などの処理結果を記録できる。

この情報は、監査、デバッグ、二重転送防止に有用である。

## Usage Notes

- Dirty Key Processing は、処理済み Dirty Key の記録として読む。
- Work Item を作るとき、Dirty Key Processing に記録済みの Dirty Key は除外する。
- Work Item の処理が終わったら、Dirty Key Processing に Dirty Key ID、転送先設定 ID、処理結果、Transfer Run を記録する。
- Dirty Key Processing は、Dirty Key 自体に処理済み状態を書き込まないための分離概念である。
- Dirty Key Processing は、Transfer Setting と Destination Link の文脈を持つ。
- Dirty Key Processing の具体的な保存形式、ロック、ユニーク制約、リトライ方法は、この文書では定義しない。
