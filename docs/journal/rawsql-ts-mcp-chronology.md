# rawsql-ts MCP 開発 chronology

この記録は、完成した機能の一覧ではなく、問いがどう変わったかを残すための時系列メモである。`Observed` はPR、テスト、dogfooding、traceで確認できる事実、`Interpretation` はその時点または後からの読み取り、`Hypothesis` はまだ証明されていない考えとして区別する。

## 2026-08-11 — Phase: 最初のMCP server（PR #964）

**Hypothesis**

rawsql-tsにすでにあるSQL解析能力をlocal MCPとして公開すれば、LLMのSQL調査を直接強化できる。

**Action**

6つの静的調査toolをrawsql-ts monorepoへ移し、MCP serverとして公開した。DB接続、SQL実行、ファイル更新を行わない境界を置いた。

**Observed**

PR #964 `feat(mcp): add local SQL investigation server` がmergeされた。レビューではruntime outputと公開TypeScript型の不一致、file scan contractなどを修正した。

**Changed belief / Interpretation**

単に既存関数をwrapperで包むだけではなく、AIへ渡す公開契約そのものを固定する必要があると分かった。

**Next question**

実プロジェクトのDDLやformatter設定を、安全にworkspaceから渡せるか。

## 2026-08-11 — Phase: 共通I/Oと既存tool接続（PR #965–#966）

**Hypothesis**

inline SQLだけでなく、workspace内のDDLと既存formatter設定を使えれば、MCPは実用的な調査面になる。

**Action**

workspace confinement、recursive DDL loading、formatter validation、generated SQL artifactだけを整形する境界を共通化し、既存6 toolへ接続した。

**Observed**

path traversal、absolute path、symlink escape、resource limitをテストした。formatter optionの正本をcore側へ寄せ、MCP側の重複runtime specificationを避けた。original/evidence SQLは整形対象外として維持された。

**Changed belief / Interpretation**

AI向けinterfaceでも、filesystem boundaryとevidence integrityは通常のlibrary APIと同じか、それ以上に重要だった。

**Next question**

解析以外の、validationやquery contract確認も独立した用途になるか。

## 2026-08-11〜12 — Phase: validation、contract、usage context（PR #967）

**Hypothesis**

table-oriented structure、column lineage、migration/transformという役割を分け、validationとcontract確認を加えると、toolの使いどころが明確になる。

**Action**

`validate_sql`、`inspect_query_contract`、`format_sql`を加え、usage searchのcontext filteringも整備した。

**Observed**

tool catalogは10個へ増えた。各toolの責務は以前より明示されたが、この時点ではagentが自然に選ぶかは未確認だった。

**Changed belief / Interpretation**

機能の存在意義を説明できる粒度は改善した。ただし、説明できることとagentが発見・選択できることは別問題だった。

**Next question**

queryの一部分を安全に指し示し、再利用できるstable identityを作れるか。

## 2026-08-12 — Phase: stable query scope selector（PR #968）

**Hypothesis**

query scopeをparser-backedなstable selectorで表せれば、後続の安全な切り出しを文字列位置に依存せず行える。

**Action**

root、CTE、derived query、expression subquery、set branchをV1 selectorで表すquery-scope foundationを追加した。

**Observed**

mixed correlated/unresolved、unsupported statements、selector stabilityなどのcorrectness reviewを通じてfail-closed contractを固めた。

**Changed belief / Interpretation**

AIにSQL断片を返す前に、どのscopeを選んだかを再現可能な構造として固定する必要があると分かった。

**Next question**

selectorからstandalone SQLを生成するとき、correlationとCTE lexical contextをどこまで証明できるか。

## 2026-08-13 — Phase: safe query slicing（PR #969）

**Hypothesis**

安全なscopeだけをstandalone SQLとして返し、不明な場合はSQLを出さなければ、LLM調査を支援しつつunsafe candidateを避けられる。

**Action**

`slice_query`を実装した。correlated/unresolved scope、recursive/forward CTE、transitive lexical visibilityを検証し、証明できない場合はblockedで停止するようにした。

**Observed**

safe derived/CTE scopeは`ready`、correlated/unresolved contextはSQLなしの`blocked`となった。forward CTE dependencyはtransitive edgeまで追加修正が必要だった。

**Changed belief / Interpretation**

便利なcandidate SQLを返すことより、誤ったcandidateを返さないことを優先する設計が明確になった。

**Next question**

10 toolsまで揃ったが、さらに作る根拠はあるのか。

## 2026-08-13 — Phase: Product Gateとcorrectness gap（PR #970–#971）

**Hypothesis**

実装可能性ではなく、実利用の証拠からcatalogの十分性を判定すべきである。

**Action**

10-tool catalogをA–J scenarioで評価した。compound predicate内の`EXISTS` scope classificationにcorrectness gapを発見し、PR #970で修正した。PR #971で最終decisionを記録した。

**Observed**

最終判定は `done / current-10-tools-sufficient`。Phase 4C output-column slicingは証拠不足でdeferredとなった。keep 10、questionable 0、consolidation candidate 0。

**Changed belief / Interpretation**

「作れるから作る」を止めた。catalogを増やすことより、現在の能力が実際にどこで価値を持つかを確かめる段階へ移った。

**Next question**

toolを使える状態にするだけで、agentの調査品質は本当に上がるのか。

## 2026-08-13 — Phase: 最初のblack-box agent dogfooding

**Hypothesis**

rawsql MCPを利用可能にすれば、複雑SQL調査でagentが自然にtoolを選び、native-onlyより良い回答を返す。

**Action**

rawsql固有の攻略法を教えず、10 scenarioでMCPなし/ありを比較した。

**Observed**

平均回答品質はほぼ同じで、MCPが明確に優れたscenarioは0。MCPが有用と期待した8 scenario中、rawsqlを使ったのは1。cross-file impact searchでは5 callsが発生し、1 callはredundantだった。`slice_query`はCodex CLIでschema materialization errorとなった。

**Changed belief / Interpretation**

LLMのSQL直接読解力を過小評価していた可能性が高くなった。一度、AST解析MCPそのものが不要なのではないかという疑問が現実的になった。

**Next question**

LLMを「より賢くする」以外に、決定論的処理を外部化する価値はあるか。

## 2026-08-14 — Phase: Durable Value Evaluation

**Hypothesis**

agentがすでにSQLを理解できても、exhaustive、deterministic、reproducible、fail-closedな処理にはモデル能力と競合しない価値が残る。

**Action**

自然利用、直接MCP capability control、tool-choice diagnosisを分離した。semantic grepを30/300/1500 files、DDL ownershipを10/100/500 tablesで反復し、safe transform、slice、fixture、negative controlsも評価した。

**Observed**

直接MCP 108 callsはcontract error 0、同一入力でbyte-identical。semantic grepは1500 filesでもsub-secondでrecall/precision 100%。DDL ownershipは500 tablesでも安定した。fixtureでは自然回答6回中4回がjoin columnsから完全計画を推測して`done`とした一方、engineは物理FKの証拠不足から`partial`で停止した。自然利用ではMCP available 18 runs中rawsql callは0で、input tokensは12.6%増えた。評価oracle自身にもoptional-condition safetyの誤りが見つかった。

**Changed belief / Interpretation**

問いは「MCPでLLMを賢くできるか」から「LLMが十分賢くても、証明可能なcomputationを外部化する価値はあるか」へ変わった。engineのdurable valueと、MCP integrationの価値を分けて考える必要がある。

**Next question**

既存engineの価値を、必要な場面だけagentへ自然に届け、context overheadを抑えられるか。

## 2026-08-14 — Phase: Integration improvement loop開始

**Hypothesis**

現在の主因はcore capability不足ではなく、host compatibility、agent-visible metadata、tool selection、result presentationにある。

**Action**

最大6 iteration、dev/holdout分離、固定prompt、3 repetitions、改善なしはrevertという有限ループを開始した。integration実験とこのjournalを別branchに分離した。

**Observed**

開始時点では未評価。baseline evidenceは、natural selection 0/18、`slice_query` host error、MCP availabilityによるtoken overhead、large full/detail resultである。

**Changed belief / Interpretation**

未確定。iterationごとに追記する。

**Next question**

最初の最小変更はschema compatibilityか、discoverability metadataか。両方を同時に変えず、どちらが選択阻害の根因かを切り分ける。

## 2026-08-14 — Phase: Integration baselineとharness failure

**Hypothesis**

frozen scenario、ground truth、fresh session、trace、tokenを固定すれば、metadata変更の効果を自然利用で比較できる。

**Action**

semantic impact、DDL ownership、safe transform、fixture extraction、simple negativeのdev setと、別文面のholdout setを作り、変更前にSHA-256を固定した。

**Observed**

最初のrunnerは120秒で外部commandが終了し、15反復中2件しか完了しなかった。完了済みrunを保持するresume機構を追加してbaselineを完遂した。baselineのpositive 12 runsではrawsql callが0、Codex hostは`slice_query`を計70回materializeできずに除外した。

**Changed belief / Interpretation**

評価の信頼性はscenario設計だけでなく、途中終了から同一条件で回復できるharnessにも依存する。toolを「使わなかった」ことと、hostがtoolを「見せられなかった」ことも分けて測る必要があった。

**Next question**

`slice_query`の非互換はserver側で後方互換に回避できるか。

## 2026-08-14 — Phase: `slice_query` host compatibility

**Hypothesis**

tuple-restから生成されたJSON Schemaの`items` arrayと`additionalItems`がCodex hostのmaterializerと合わない。

**Action**

selector pathをsingle-item-schema arrayとして公開し、rootが先頭に一度だけ現れるruntime制約はrefinementと回帰テストで維持した。

**Observed**

Codex host warningはdev 15 runsで70から0になった。既存selector round-tripと不正root位置の拒否は維持された。しかしpositive selectionは0/12のままだった。

**Changed belief / Interpretation**

Callableの欠陥は直せたが、CallableとDiscoverableは別の段階だった。toolがcatalogへ戻っただけではagentは選ばない。

**Next question**

agent-visible metadataはuser intentとtool capabilityを結びつけられるか。

## 2026-08-14 — Phase: metadata experimentsとplateau stop

**Hypothesis**

use-when中心のtool description、または短いserver instructionsで、local/static/read-only capabilityの誤認を解ける。

**Action**

Iteration 2では10 toolのdescriptionとannotationを拡充した。改善しなかったためrevertし、Iteration 3では短いserver-level instructionsだけを試した。

**Observed**

どちらもpositive selectionは0/12だった。長いmetadataは汎用resource探索を1回誘発し、48 KBの結果とinput token増加を伴った。server instructionsも自然選択を変えなかった。2 iteration連続で採用可能な改善がなく、事前のplateau conditionで停止した。

**Changed belief / Interpretation**

説明不足だけを根因とみなす仮説は支持されなかった。agentがshellで十分に回答できる場面では、tool metadataの改善だけでdeterministic engineへ処理を移すとは限らない。

**Next question**

自然選択を変えないままcatalog costを増やさず、どのhost integration surfaceならdeterministic computationの価値を届けられるか。現時点では証拠不足であり、新機能には進まない。

## 2026-08-14 — Phase: final holdoutと部分的なclose

**Hypothesis**

host-compatible schemaだけを残したfinal candidateは、少なくともCallableを改善し、negative workloadを悪化させない。

**Action**

positive 3、negative 1の凍結holdoutを一度だけ実行し、結果後の調整を禁止した。

**Observed**

host warningは0、negative false-selectionも0だった。一方、positive rawsql selectionは0/3で、natural speed/context advantageは顕在化しなかった。

**Changed belief / Interpretation**

最終判定は `done / partial-integration-improvement`。engineの価値はdirect evaluationで残ったが、MCP natural integrationの価値は未解決である。今回残せたのは、消えていた`slice_query`をhostからcallableに戻したことと、説明を増やすだけでは不十分だという負の証拠だった。

**Next question**

次の変更は想像で始めない。実利用で、既存10 toolsが必要なのに選ばれない具体的workflowとtraceが再び得られたときだけ調査する。

## 2026-08-14 — Phase: 明示利用のend-to-end評価

**Hypothesis**

自然選択の問題を切り離し、ユーザーまたはpolicyがrawsql MCPの利用を明示すれば、exhaustiveまたはfail-closedなworkflowでengineの価値がend-to-endにも現れる。

**Action**

MCPなしと固定の明示利用文を加えたMCPありを、同一model、fresh session、3 repetitionsで比較した。semantic grep 30/300/1500 files、DDL ownership 10/100/500 tables、safe transform、safe extraction、fixture planning、negative controlsを66 scored runsで評価した。

**Observed**

semantic grepは両条件でrecall/precision 100%だったが、MCP条件は全3規模でwall timeとinput tokensを削減した。fixture planは物理FK不足を一貫してpartialに保ち、safe extractionはcorrelated/unresolvedなboundaryでSQLを返さなかった。一方、DDL ownershipはnativeも全件正しく、agentが平均8〜10.7回のrawsql callを行ったMCP条件は約2倍遅くcontextも増えた。2件のnegative controlsでもMCP overheadが上回った。

最初のextraction inputはselectorを公開しており、要求された`analyze_query_structure`からのworkflowを評価できなかった。6 runsを証拠として残したまま採点から除外し、selectorなしのinputで同一promptを再実行した。MCP engine totalはBの25.1分中9.69秒で、遅いworkflowの主因はengineではなくagent orchestrationとresult consumptionだった。

**Changed belief / Interpretation**

明示利用には条件付きの価値がある。large semantic searchやfail-closed safetyでは「この仕事ではMCPを使え」と指示する根拠がある。しかしtool利用自体を目的にすると、simple SQL、既知の小さなCTE、nativeで十分なDDL reviewでは逆効果になる。自然選択の未解決を成功に読み替える結論でも、全SQLをMCPへrouteする結論でもない。

**Next question**

新機能には進まない。今後は実利用でexplicit routingを適用した具体的なworkflowから、call duplicationやresult consumptionが実際に作業を阻害した場合だけ再調査する。

## Evidence links

- [MCP Product Gate Evidence](../dogfooding/mcp-product-gate-2026-08.md)
- [MCP Product Decision](../dogfooding/mcp-product-decision-2026-08.md)
- [MCP Agent Dogfooding](../dogfooding/mcp-agent-dogfooding-2026-08.md)
- [MCP Durable Value Evaluation](../dogfooding/mcp-durable-value-evaluation-2026-08.md)
- [MCP Explicit-Use Value Evaluation](../dogfooding/mcp-explicit-use-value-evaluation-2026-08.md)
