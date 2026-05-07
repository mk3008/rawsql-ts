# Lineage Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Lineage の Concept Spec である。

Lineage は、転送先行の転送元を特定し、転送先行の元ネタを追跡できるようにする概念である。

この文書は、Lineage の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- Lineage とは、転送先行と、その転送先行の転送元を紐づける追跡情報である。
- Lineage は、転送が実行され、転送先行が生成または記録された場合に存在する。
- 転送先行が生成または記録されていない場合、Lineage は存在しない。
- Lineage は、転送先行の元ネタが何であるかを追跡できるようにする。
- Lineage は、監査用途とデバッグ用途を持つ。
- Lineage は、転送元行の現在値を表すものではない。
- Lineage は、転送時点で参照された transfer source と、生成された destination row の対応を記録する。
- Black Transfer では、transfer source は転送元データソースの論理行である。
- Red Transfer では、transfer source は反転対象となった既存の転送先行である。
- Lineage は、Transfer Run を参照することで、その対応がどの実行文脈で作られたかを追跡できる。
- この文書では、Lineage は immutable transfer model の転送時に存在する概念として扱う。

## Non-responsibilities

- Lineage は転送元行の現在値を管理しない。
- Lineage は転送先行の現在状態を管理しない。
- Lineage は、どの行を次に転送すべきかを決定しない。
- 転送対象かどうかは、Work Item の文脈で判断する。
- Lineage は、転送依頼や転送実行そのものを管理しない。
- Lineage は、転送前の作業対象行を管理しない。
- Lineage は、赤伝時に参照すべき現在有効な黒を決定しない。
- Lineage は mutable transfer model の転送先行を追跡する正本としては扱わない。
- Lineage は処理ログ一般、監査ログ一般、実行ログ一般ではない。

## Responsibilities

- Lineage は、転送元を識別できる情報を持つ。
- Lineage は、転送先行を識別できる情報を持つ。
- Lineage は、どの Transfer Run によって転送されたかを参照できる。
- Lineage は、どの Transfer Setting に基づく転送かを参照できる。
- Lineage は、どの Destination への転送かを参照できる。
- Lineage は、転送元と転送先行の対応を監査やデバッグで追跡できる形で保持する。

## Invariants

- Lineage は、転送が存在する場合にだけ存在する。
- Lineage は、転送元から転送先行への対応を `0..N` として扱う。
- Lineage は、転送先行から転送元への対応を `0..1` として扱う。
- Lineage は、必ず1つの Transfer Run に紐づく。
- Lineage が保証するのは transfer source と destination row の対応関係であり、転送元の値スナップショットそのものではない。
- Lineage は、紐づけを保証するものであり、転送元と転送先行の現在値の一致を保証しない。
- Lineage は、immutable transfer model の履歴転送を追跡するための概念として扱う。
- mutable transfer model では、この文書の仮定として Lineage を持たない。

## Why

### Lineage Exists Only After Transfer

Lineage は、転送先行と、その転送先行の転送元を紐づける概念である。

転送していなければ、紐づける転送先行が存在しない。

そのため、Lineage は転送対象候補や転送依頼ではなく、転送された結果を追跡するために存在する。

### Lineage Tracks Correspondence, Not Source Row Values

Lineage は、転送時点で参照された transfer source と、生成された destination row の対応を記録する。

Lineage が保証するのは対応関係であり、転送元の値スナップショットそのものではない。

Black Transfer では、transfer source は転送時に参照された転送元データソースの論理行を指す。
物理テーブルの1行とは限らない。

Red Transfer では、transfer source は反転対象となった既存の転送先行を指す。
赤伝は転送元データソースの現在値から作るのではなく、既に転送されている黒伝を反転して作る。

Lineage は Transfer Run を参照する。
対応関係を記録した実行文脈は、Lineage 自体ではなく Transfer Run 側の実行文脈から追跡できるようにする。

転送後に転送元が更新または取り消された場合、Lineage が示す転送元と転送先行の値が現在値として一致しないのは自然である。
Lineage は現在値の一致ではなく、転送結果としての紐づけを保証する。

### Source to Destination Is Zero to Many

転送元は、更新、削除、訂正、取消により複数回転送されることがある。

immutable transfer model では、更新時に元黒の赤伝と新黒の追加が発生し、削除時に元黒の赤伝が発生する可能性がある。

そのため、転送元から転送先行への Lineage は `0..N` として扱う。

### Destination to Source Is Zero or One

Lineage の cardinality は destination row 単位で考える。

1つの transfer source から複数の destination row が生成されることはある。
たとえば、1つの仕訳 source row から、借方の科目残高 row と貸方の科目残高 row が生成される場合がある。

この場合でも、借方の destination row から見た transfer source は1つであり、貸方の destination row から見た transfer source も1つである。

そのため、転送先行から転送元への Lineage は `0..1` として扱う。

`0` があり得るのは、転送元が物理削除されるなど、後から参照できなくなる場合があるためである。

### Lineage Is for Immutable Transfer Model

この文書では、Lineage は immutable transfer model の転送時に存在する概念として扱う。

immutable transfer model では、転送先行を履歴として積み増すため、転送先行の転送元を追跡する意味がある。

mutable transfer model では、転送先行を直接更新または Physical Delete Transfer で削除する。
上書きした時点で、転送先行に対する履歴としての Lineage を持ちようがない。

そのため、この文書では、mutable transfer model は Lineage を持たないと扱う。
監査、ログ調査、可視化、分析、二次利用のために転送履歴を追跡したい場合は、mutable transfer model ではなく immutable transfer model を選ぶ。

mutable transfer model で処理追跡が必要な場合、それは Lineage ではなく、処理ログ、監査ログ、または別の追跡概念として扱う。

### Active Black Uses a Separate Axis

Lineage は immutable transfer model における転送先行の由来追跡である。

現在有効な黒伝の選択は、Lineage そのものではなく別の概念で扱う。

## Usage Notes

- Lineage は、転送先行の元ネタを監査またはデバッグで追跡するために使う。
- Lineage は、転送元の現在値を復元するための概念ではない。
- Lineage は、転送元の値スナップショットそのものを保持する概念ではない。
- Lineage は、転送前の候補行や作業対象行を表さない。
- Lineage は、Transfer Run を参照することで、その転送先行がどの実行文脈によって生成されたかを追跡できる。
- key map という表現は、Lineage が持つ source key と destination key の対応を説明するために使われることがある。
- mutable transfer model では Lineage を持たない。mutable transfer model のログが必要な場合は、処理ログ、監査ログ、または別の運用記録として扱う。
