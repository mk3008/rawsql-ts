# Transfer Execution Concept Spec

## Position

この文書は、`@rawsql-ts/transfer` における Transfer Execution の Concept Spec である。

Transfer Execution は、Transfer Run をプロセスヘッダーとして生成し、Work Item、Dirty Key Processing、Transfer Setting、Dirty Key、Active Black、Black Transfer、Red Transfer、Physical Delete Transfer を参照してデータ転送を実行するメインルーチンである。

この文書は、Transfer Execution の意味、責務、非責務、不変条件を固定する。実装手順、SQL、DDL、転送処理の具体ロジックは定義しない。

## Definition

- Transfer Execution とは、データ転送処理のメインルーチンである。
- Transfer Execution は、実行引数を Transfer Run として記録する。
- Transfer Run は、Transfer Execution の実行引数記録兼プロセスヘッダーである。
- Transfer Run は、Transfer Execution に従属する。
- Transfer Execution は、対象 Transfer Setting に従って転送する。
- Transfer Execution は、Transfer Run に記録された引数を転送条件として利用してよい。
- Transfer Execution は、転送対象となる行を Transfer Run の引数として直接受け取らない。
- Transfer Execution は、Dirty Key Management に蓄積された変更検知履歴を Work Item として固定化する。
- Transfer Execution は、Work Item を作るとき Dirty Key Processing に記録済みの Dirty Key を除外する。
- Transfer Execution は、Work Item に整理された情報をもとに、どの転送表現を使うかを判断する。

## Non-responsibilities

- Transfer Execution は、Transfer Run を事前に積まれた実行待ち項目として扱わない。
- Transfer Execution は、Dirty Key 自体に処理済み状態を書き込まない。
- Transfer Execution は、Transfer Setting の内容や Destination の転送先仕様を変更しない。
- Transfer Execution は、Dirty Key の登録方法を定義しない。
- Transfer Execution は、Black Transfer、Red Transfer、Active Black、Lineage の保存形式を定義しない。
- Transfer Execution は、スケジューリングそのものを管理しない。
- Transfer Execution は、SQL 生成手順や SQL 実行手順の具体形を定義しない。

## Responsibilities

- Transfer Execution は、実行引数を Transfer Run として作成し、実行開始時の引数と進捗状態を追跡できるようにする。
- Transfer Execution は、対象 Transfer Setting を参照する。
- Transfer Execution は、Transfer Setting に紐づく Destination 群を参照する。
- Transfer Execution は、Dirty Key Management に蓄積された行を Work Item として固定化する。
- Transfer Execution は、Work Item が持つ転送判断をもとに、実際にどう転送するかへ解釈する。
- Transfer Execution は、転送元の現在値が存在するかどうかを確認する。
- Transfer Execution は、既存の Active Black が存在するかどうかを確認する。
- Transfer Execution は、Destination の transfer model に応じて Black Transfer、Red Transfer、Physical Delete Transfer、または何もしない判断を行う。
- Transfer Execution は、immutable transfer model では Lineage 作成を伴う Black Transfer または Red Transfer を選択できるようにする。
- Transfer Execution は、転送が終わった Work Item を Dirty Key Processing に記録し、処理済みとして扱える状態にする。

## Invariants

- Transfer Execution は、必ず Transfer Run をプロセスヘッダーとして持つ。
- Transfer Execution は、Transfer Run を生成する。
- Transfer Execution は、必ず1つの Transfer Setting を対象にする。
- Transfer Execution は、転送対象行を Transfer Run の引数として受け付けない。
- Transfer Execution は、Dirty Key を変更通知として扱い、Dirty Key だけで転送操作を決定しない。
- Transfer Execution は、Dirty Key を Work Item として固定化してから転送処理に使う。
- Transfer Execution は、Work Item を作る前に Dirty Key Processing を参照して処理済み Dirty Key を除外する。
- Transfer Execution は、Dirty Key 自体に処理済み状態を書き込まない。
- Transfer Execution は、転送が終わった Work Item を Dirty Key Processing に記録する。
- Transfer Execution は、転送元の現在値と Active Black の有無を判断材料として扱う。
- Transfer Execution は、Destination の transfer model に従って転送表現を選ぶ。
- immutable transfer model では、Lineage は Black Transfer または Red Transfer の成功結果として扱う。
- immutable transfer model では、既存の Active Black を取り消す場合に Red Transfer を使う。
- mutable transfer model では、既存行の現在値反映は Black Update Transfer として扱い、取消は Physical Delete Transfer として扱う。

## Why

### Transfer Execution Owns the Main Routine

Transfer Execution は、転送処理のメインルーチンである。

Transfer Run は Transfer Execution の引数記録兼プロセスヘッダーであり、実行全体のライフサイクル状態を保持するが、転送判断そのものではない。

Dirty Key は変更通知であり、どのように転送するかを決定しない。

そのため、Transfer Execution が、Transfer Run に記録された引数、Transfer Setting、Work Item、Active Black、Destination の transfer model を参照して、転送表現を選ぶ。

### Transfer Run Provides the Execution Context

Transfer Execution は、転送元、転送条件、実行開始時引数を Transfer Run として記録する。

Transfer Run は、Transfer Execution が生成する実行引数記録兼プロセスヘッダーである。

Transfer Run は、進捗管理、監査、デバッグの実行文脈として有用である。

Transfer Execution は対象 Transfer Setting を実行し、その実行文脈を Transfer Run として残す。

### Dirty Key Provides Candidates, Not Operations

Dirty Key は、転送元行に何らかの変更が起きた可能性を示す。

Dirty Key は変更通知であり、Black Transfer、Red Transfer、Physical Delete Transfer、または何もしない判断を直接表さない。

Transfer Execution は、Dirty Key が示す候補を Work Item として固定化する。

Transfer Execution は、Work Item について、転送元の現在値と Active Black の有無を確認する。

Work Item は、Dirty Key ID と転送判断を Transfer Setting の文脈で保持できる必要がある。

Transfer Execution は、処理後に Dirty Key Processing へ記録し、Work Item を処理済みとして扱える状態にする。

### Transfer Decision Depends on Current Source and Active Black

Transfer Execution は、Work Item について、転送元の現在値と Active Black の有無を組み合わせて判断する。

転送元の現在値が存在し、Active Black がない場合、Black Transfer を行う。

転送元の現在値が存在し、Active Black がある場合、transfer model によって判断が分かれる。

- immutable transfer model では、Red Transfer 後に Black Transfer を行う。
- mutable transfer model では、Black Update Transfer を行う。

転送元の現在値が存在せず、Active Black がない場合、転送するものはない。

転送元の現在値が存在せず、Active Black がある場合、transfer model によって判断が分かれる。

- immutable transfer model では、Red Transfer を行う。
- mutable transfer model では、Physical Delete Transfer を行う。

この判断表は概念上の責務境界であり、SQL、トランザクション、リトライ、ロック、バッチ分割などの実装手順ではない。

### Immutable Transfer Produces Traceable Destination Rows

immutable transfer model では、転送先行を履歴として積み増す。

そのため、Black Transfer または Red Transfer が成功した場合、生成された転送先行の由来を Lineage として追跡できる必要がある。

Transfer Execution は Lineage を直接記録する概念ではなく、Lineage 作成を伴う転送表現を選択する。

## Usage Notes

- Transfer Execution は、転送処理のメインルーチンを説明するために使う。
- Transfer Execution は、Transfer Run を実行引数記録兼プロセスヘッダーとして生成する。
- Transfer Run は、Transfer Execution に従属する。
- Transfer Execution は、Dirty Key を Work Item として固定化してから転送処理に使う。
- Transfer Execution は、Dirty Key Processing に記録済みの Dirty Key を Work Item から除外する。
- Transfer Execution は、Work Item に整理された転送元の現在値、Active Black、transfer model を組み合わせて転送表現を選ぶ。
- Transfer Execution は、転送後に Dirty Key Processing へ Dirty Key ID、転送先設定 ID、処理判断、Transfer Run を記録する。
- immutable transfer model では、更新相当の転送は Red Transfer と Black Transfer の組み合わせで説明できる。
- mutable transfer model では、更新相当の転送は Black Update Transfer として説明できる。
- Transfer Execution の具体的な保存形式、SQL、トランザクション境界、リトライ方法は、この文書では定義しない。
