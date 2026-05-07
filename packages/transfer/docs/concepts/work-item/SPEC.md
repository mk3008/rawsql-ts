# Work Item Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Work Item の Concept Spec である。

Work Item は、Dirty Key Management に蓄積された変更検知履歴を、Transfer Execution が処理できる作業対象として固定化し、転送判断を付与した概念である。

この文書は、Work Item の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- Work Item とは、Dirty Key から固定化された転送作業対象である。
- Work Item は、Dirty Key そのものではない。
- Work Item は、Dirty Key を特定の Transfer Setting の文脈で評価する。
- Work Item は、必要に応じて Transfer Setting と Destination Link の文脈で評価される。
- Work Item は、固定化されただけでは転送に使えない。転送判断が必要である。
- Work Item は、Dirty Key、転送元の現在値、Active Black、Destination の transfer model をもとに転送判断を持つ。
- Work Item は、処理済みかどうかを Dirty Key へ書き戻さない。
- Work Item の処理済み記録は、Dirty Key Processing に残す。

## Non-responsibilities

- Work Item は、Dirty Key Management の変更検知履歴を変更しない。
- Work Item は、Dirty Key 自体に処理済み状態を書き込まない。
- Work Item は、Dirty Key の登録方法を定義しない。
- Work Item は、Transfer Run の実行引数記録兼プロセスヘッダーを代替しない。
- Work Item は、Dirty Key Processing の処理済み記録を代替しない。
- Work Item は、Black Transfer、Red Transfer、Active Black、Lineage の保存形式を定義しない。
- Work Item は、転送 SQL の生成手順や実行手順を定義しない。

## Responsibilities

- Work Item は、Dirty Key から処理対象を固定化する。
- Work Item は、どの Dirty Key に由来するかを追跡できる必要がある。
- Work Item は、どの Transfer Setting の文脈で判断されたかを追跡できる必要がある。
- Work Item は、必要に応じてどの Destination Link の文脈で判断されたかを追跡できる必要がある。
- Work Item は、転送元の現在値が存在するかどうかを判断材料として保持できる必要がある。
- Work Item は、Active Black が存在するかどうかを判断材料として保持できる必要がある。
- Work Item は、transfer model を踏まえた転送判断を持つ。
- Work Item は、Transfer Execution が Black Transfer、Red Transfer、Physical Delete Transfer、または何もしない判断を実行できるようにする。
- Work Item は、Dirty Key Processing を参照して処理済み Dirty Key を除外できる必要がある。
- Work Item の処理が終わった後、Dirty Key Processing に処理済み記録を残せる必要がある。

## Invariants

- Work Item は、Dirty Key を固定化して作られる。
- Work Item は、少なくとも1つの Dirty Key に由来する。
- Work Item は、Dirty Key の処理済み状態を Dirty Key Management に書き戻さない。
- Work Item は、Dirty Key Processing にある Dirty Key を処理済みとして除外する。
- Work Item の処理済み記録は、Dirty Key Processing に残す。
- 同じ Dirty Key でも、Transfer Setting が異なれば Work Item の判断は異なり得る。
- 同じ Dirty Key でも、Destination Link や transfer model が異なれば Work Item の判断は異なり得る。
- Work Item は、Dirty Key だけで転送判断を決めない。
- Work Item は、転送元の現在値、Active Black、Destination の transfer model を転送判断の材料として扱う。
- Transfer Execution は、Work Item に整理された情報をもとに適切な Black Transfer、Red Transfer、Physical Delete Transfer、または何もしない判断を実行する。

## Why

### Dirty Key Must Be Fixed Before Transfer

Dirty Key Management は、変更検知履歴として常に追記され続ける。

Dirty Key は、同じキーに対して複数回記録されてよい。

そのため、Transfer Execution が処理するには、どの Dirty Key を今回の作業対象として扱うかを固定化する必要がある。

Work Item は、その固定化された作業対象である。

### Fixed Dirty Key Still Needs a Transfer Decision

Dirty Key は変更通知であり、転送操作を表さない。

Dirty Key を Work Item として固定化しただけでは、まだ転送に使えない。

Work Item は、転送元の現在値、Active Black、Destination の transfer model をもとに、どの転送判断を行うかを持つ必要がある。

### Work Item Decision Categories

Work Item の転送判断は、概念上少なくとも次の7つに分類される。

| Decision | Meaning |
|---|---|
| no-op because source is already gone | 転送前に転送元の現在値がなく、Active Black もないため、何もしなくてよい。 |
| red then black insert transfer | 転送元の現在値があり、Active Black もあり、immutable transfer model であるため、Red Transfer 後に Black Insert Transfer する。 |
| black insert transfer | 転送元の現在値があり、Active Black がないため、Black Insert Transfer で黒伝を追加する。 |
| red transfer | 転送元の現在値がなく、Active Black があり、immutable transfer model であるため、Red Transfer する。 |
| black update transfer | 転送元の現在値があり、Active Black があり、mutable transfer model であるため、Black Update Transfer として既存の黒伝を直接 UPDATE する。 |
| physical delete transfer | 転送元の現在値がなく、Active Black があり、mutable transfer model であるため、Physical Delete Transfer として Active Black に対応する転送先行を物理削除する。 |
| ignore duplicate dirty | 同じ転送判断として既に扱われた重複 Dirty Key であるため、転送操作を行わない。 |

この分類は概念上の転送判断であり、最終的な列名、enum 名、SQL、テーブル設計を定義するものではない。

### Dirty Key Does Not Own Processed State

Dirty Key は変更検知履歴であり、Transfer Setting ごとの処理状態ではない。

同じ Dirty Key でも、Transfer Setting が異なれば転送判断は異なり得る。

そのため、Dirty Key 自体に処理済みかどうかを書き込んではならない。

Work Item の処理済み記録は、Dirty Key Processing に残す。

Dirty Key Processing は、Dirty Key ID、転送先設定 ID、処理結果、Transfer Run を記録し、Transfer Setting と Destination Link の文脈で処理済みを追跡できる必要がある。

### Transfer Execution Uses Work Items

Transfer Execution は、Work Item に整理された情報をもとに、適切な Black Transfer、Red Transfer、Physical Delete Transfer、または何もしない判断を実行する。

転送が終わったら、Transfer Execution は Dirty Key Processing に記録し、Work Item を処理済みとして扱える状態にする必要がある。

これは、同じ Work Item を複数回転送しないためである。

## Usage Notes

- Work Item は、Dirty Key を転送処理で扱える単位へ固定化するために使う。
- Work Item は、Dirty Key のコピーではなく、Transfer Setting の文脈で判断された作業対象として読む。
- Work Item は、転送判断を持つ。
- Work Item の判断は、Dirty Key、転送元の現在値、Active Black、transfer model に依存する。
- Work Item は、Dirty Key 自体に処理済み状態を書き込まない。
- Work Item は、処理済み記録の正本を Dirty Key Processing に置く。
- Transfer Execution は、Work Item に整理された情報をもとに Black Transfer、Red Transfer、Physical Delete Transfer、または何もしない判断を実行する。
- Work Item の具体的な保存形式、ロック、重複排除、リトライ方法は、この文書では定義しない。
