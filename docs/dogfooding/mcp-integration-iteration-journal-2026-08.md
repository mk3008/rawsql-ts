# rawsql-ts MCP integration improvement iteration journal — 2026-08

この文書は、採用した最終変更だけでなく、revertした実験と判断理由を残す実験日誌である。benchmark結果の詳細表は最終レポートへまとめるが、各iterationの仮説が後知恵で書き換わらないよう、実験前の時点で追記する。

## 実験境界

- 最大6 iteration。
- dev scenarioだけを改善中に使用する。
- holdout promptは最終候補まで見ない。
- natural-use promptへrawsql固有の攻略法を書かない。
- positive selection、negative false-selection、correctness、安全性、wall time、tokens、payload、repeated callを別々に測る。
- 改善がなければ原則revertする。
- holdout後に追加調整しない。

## Baseline — 2026-08-14

### Observed

- Product Gate: `done / current-10-tools-sufficient`。
- 最初のblack-box dogfoodingでは、有用と想定した8 scenario中rawsql利用は1。impact searchは5 callsで、そのうち1 callはredundantだった。
- Durable Value Evaluationでは、MCP available 18 runs中rawsql callは0。
- MCP availabilityだけでinput tokensはnative-onlyより12.6%増えた。
- 直接MCP 108 callsはerror 0、同一入力でbyte-identical。
- `slice_query`はCodex CLIで `invalid type: map, expected a string` によりmaterializeされない。
- 1500-file detail usage searchは約1.35 MiB、full lineageは入力より大きい。

### Interpretation

core capabilityの不足よりも、host compatibility、toolの発見と意味理解、結果presentationが価値の顕在化を阻害している可能性が高い。ただし「descriptionを書き換えれば使われる」はまだ仮説である。

### Current question

agent-visible schemaとmetadataを実際のhostがどう受け取り、どの段階でcandidateから落としているか。最初にharnessとStage 0再現を固定し、その後の変更を1〜2仮説ずつ比較する。

## Iteration index

| Iteration | Hypothesis | Change | Dev result | Decision |
| ---: | --- | --- | --- | --- |
| 0 | 現行integrationではnatural selectionとhost compatibilityが失敗する | harness only | rawsql selection 0/12 positive runs、host warning 70 | baseline |
| 1 | tuple-rest selector schemaがCodex host非互換の原因 | selector pathをsingle-item-schema arrayへ変更 | host warning 70→0、selection 0/12 | host互換性修正としてkeep |
| 2 | use-when中心のtool metadataなら自然選択される | 全10 toolのdescription長文化とread-only annotation | selection 0/12、汎用resource call 1、平均input tokens増加 | revert |
| 3 | 個別descriptionでなく短いserver instructionsなら発見される | MCP initialize instructions追加 | selection 0/12、answer evidence微減 | revert、plateau stop |

## Harness construction note

最初のbaseline runnerは外部commandの120秒上限で途中終了し、15反復中2反復だけが完了した。これはMCP capabilityの失敗ではなく、評価装置の再開性不足だった。完了済みrunを保持して未完了runだけ再実行する`-Resume`を追加し、同じscenario hashのままbaselineを完遂した。

この失敗から、繰り返し評価ではscenarioやmetricだけでなく、部分完了を壊さないrunner設計もevidence integrityの一部だと判断した。

## Iteration 0 — frozen baseline

### Hypothesis

既存のnatural-use gapは、少なくとも`slice_query` materialization failureとrawsql tool discovery failureの二つに分けられる。

### Observed

- dev ground truth SHA-256: `4379117b6b62e5c86685daf32b4ba939eb9af09de4aacad25322c984329cf281`
- holdout ground truth SHA-256: `16d8832c6f1a86e2b53ed3f4ec7fcd262199cff38988449ac97b1fd37d7f2644`
- 5 scenario × 3 fresh sessions = 15 runs。
- positive 12 runsでrawsql callは0。selection recall 0%。
- negative 3 runsで不要rawsql callは0。negative avoidance 100%。
- Codex stderrの`Skipping deferred MCP tool`は70件。すべて`slice_query` schema materialization error。
- 平均wall time 25.85秒、平均input tokens 63,867、平均output tokens 799。
- toolが呼ばれていないためresult payloadは0 bytes。

### Interpretation

回答文はSQLファイルを直接読んで必要な語を含めたが、MCP integration valueは顕在化していない。まずcallableでないtoolを直す必要がある。ただしそれだけでdiscoverabilityが上がるとは限らない。

## Iteration 1 — `slice_query` host compatibility

### Hypothesis

Zodのtuple-restから生成されたDraft-07 schemaの`items: [rootSchema]`と`additionalItems`が、Codex hostのtool schema materializerと非互換である。

### Action

runtime V1 selector contractを維持したまま、path schemaを単一`items` schemaのarrayへ変更した。rootは先頭に1回だけ現れるという制約をruntime refinementで維持し、不正なroot位置を回帰テストへ追加した。

### Observed

- direct MCP `listTools()`で変更前の`items`はarray、変更後はschema object。
- focused Phase 4B tests 10件とMCP test typecheckは成功。
- natural dev 15 runsでhost warningは70→0。
- positive selectionは0/12のまま。
- 平均wall time 25.84秒、平均input tokens 68,088、平均output tokens 784。
- answer evidenceとnegative avoidanceはbaseline同等。

### Decision

host compatibility改善としてkeepする。discoverability改善の証拠にはしない。

## Iteration 2 — use-when metadata

### Hypothesis

現在のdescriptionは機能を説明しているが、agentがuser intentからtoolへ対応づけるtriggerと、summary-firstの使い方が弱い。

### Action

10 toolのdescriptionをuse-when中心へ変え、read-only、idempotent、closed-world annotationを付けた。

### Observed

- positive selectionは0/12。
- 1 runでrawsql toolではなく汎用`list_mcp_resources`を呼び、48,312 bytesをcontextへ追加した。
- 平均input tokensは73,949へ増加した。
- tool selection signatureのstabilityもsemantic impact scenarioで崩れた。

### Decision

revert。説明量の増加は自然選択を改善せず、探索noiseとcontext costを増やした。

## Iteration 3 — server instructions

### Hypothesis

個別tool descriptionより、MCP initialize時の短いserver-level instructionsの方が「local/static/read-only SQL capability」という全体像を伝えられる。

### Action

Iteration 2をrevertし、約60語のserver instructionsだけを追加した。

### Observed

- positive selectionは0/12。
- host warning 0、negative avoidance 100%。
- 平均wall time 22.85秒、平均input tokens 58,793、平均output tokens 708だったが、tool未使用なのでinstructionsによるspeed/context advantageとは帰属できない。
- answer evidence recallは1.00から0.967へ微減した。

### Decision

revert。Iteration 2と3で採用可能なdiscoverability改善が連続して得られなかったため、plateau stopとした。

## Previous five-call usage-search classification

最初のblack-box dogfoodingのcross-file impact scenarioでは、次の5 callsが行われた。

1. `public.orders.customer_id` exact column/detail: **necessary**。要求された対象を直接調べた。
2. unqualified `customer_id` with `anySchema + anyTable`: **refinement, but too broad**。同名列decoyの存在確認には使えるが、exact resultの後に全tableへ広げる必要性は弱かった。
3. `public.orders` exact table/impact: **confirmation**。column resultのowner確認として補助的だが、最終回答に不可欠ではない。
4. `public.support_tickets` exact table: **redundant**。要求対象ではなく、decoy除外は既存evidenceから可能だった。
5. `support_tickets` any-schema table: **redundant after failed exact guess**。schema不明を補正したが、4番目の不要な探索から派生したcallだった。

最小workflowは1のexact column callだけで成立していた。必要に応じて3をconfirmationとして許容できるが、2、4、5はcontextとlatencyを増やした。Iteration 2のmetadataはexact-firstを明示したものの、natural selection自体を起こせず、この再検索問題の改善は実証できなかった。

## Final holdout

final candidateはIteration 1のschema compatibility修正だけとし、凍結holdoutを1回実行した。結果を見た後の調整は行っていない。

- positive 3 runsでrawsql selection 0/3。
- negative 1 runで不要rawsql selection 0。
- host warning 0。
- 平均wall time 20.24秒、平均input tokens 46,767、平均output tokens 562。
- answer evidence recall 0.875。

## Final interpretation

最終判定は `done / partial-integration-improvement`。

`slice_query`はCodex hostでmaterialize可能になり、A. Callableの具体的欠陥は修正できた。一方、B. DiscoverableとC. Economicalはnatural selectionが0のため実証できていない。既存engineのdirect capability evidenceは維持されるが、MCP adapterが自然利用でspeed/context advantageを顕在化する状態には到達しなかった。
