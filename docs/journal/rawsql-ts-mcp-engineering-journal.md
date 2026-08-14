# MCPを作ったらLLMに使ってもらえなかった話

rawsql-tsには、SQLをASTとして解析し、構造、列の由来、条件、CTE、依存関係を取り出す能力がすでにあった。これをMCPとしてLLMから使えるようにしたら、SQL調査がかなり強くなるのではないか。当初の出発点は、その素朴な仮説だった。

この文章は完成した10個のtoolを紹介する仕様書ではない。何を作ったかより、何を期待し、どこで予想が外れ、問いがどう変わったかを残すための開発記である。事実関係の詳細は[Product Gate](../dogfooding/mcp-product-gate-2026-08.md)、[Product Decision](../dogfooding/mcp-product-decision-2026-08.md)、[Agent Dogfooding](../dogfooding/mcp-agent-dogfooding-2026-08.md)、[Durable Value Evaluation](../dogfooding/mcp-durable-value-evaluation-2026-08.md)に譲る。ここでは、そこで観測したことと、そこから考えたことを混同しないように書きたい。

## 1. 使われるであろう機能をMCPにした

最初の仮説は単純だった。LLMはSQLを扱える。しかし、query structureやcolumn lineageのような解析結果を確実に渡せば、複雑な調査はもっと正確になる。複数ファイルからtableやcolumnの使用箇所を探せれば、migrationの影響調査も速くなる。CTEを単独実行可能なSQLへ切り出したり、安全な範囲だけqueryをsliceしたりできれば、デバッグも進めやすい。fixture extraction planまで作れれば、再現環境の準備にも使える。

そこで、rawsql-tsの能力を順番にMCP化した。最初のserverは6 toolだった。その後、validation、query contract inspection、formatting、safe slicingが加わり、catalogは10 toolになった。

この時点のHypothesisは、「有用な関数を適切な粒度で公開すれば、agentは必要な場面で自然に使うだろう」というものだった。Observedとして言えるのは、toolの責務は議論を重ねるごとに整理されたことだ。初期には「SQLを分析する」と「調査対象を見つける」の違いすら説明しづらかった。最終的には、query全体の構造を見る処理、特定output columnのlineageを見る処理、安全なSQL artifactを生成する処理という別の用途へ分かれた。

しかし、責務を説明できることと、agentが発見して使えることは同じではなかった。この違いが表面化するのは、もう少し後だった。

## 2. wrapperではなく、安全境界を作った

MCP serverはcore関数を呼ぶだけの薄いwrapperにはならなかった。LLMへ結果を返す以上、曖昧なものを便利そうな形へ補完しないことが重要だったからだ。

DDLをpathから読む機構では、workspace外へ出ないことを保証した。`..`やabsolute pathだけでなく、symlinkのrealpathも境界の外なら拒否した。formatterはoriginal SQLやlineageのevidence fragmentへ一律適用せず、明示的に生成したSQL artifactだけへ適用した。元のSQLは証拠であり、見栄えのために変形してはいけないと考えたからだ。

query slicingではさらに慎重になった。文字位置でSQLを切るのではなく、parser-backedなselectorを作った。outer reference、correlation、CTEのlexical visibility、forward reference、transitive dependencyを確認し、安全を証明できるscopeだけを`ready`として返した。分からない場合は、もっともらしいSQLを作らず`blocked`にした。

Observedとして、ここでは何度もcorrectness gapがレビューで見つかった。mixed correlated/unresolvedの優先順位、後続CTEへのforward reference、compound predicate内の`EXISTS`などである。そのたびに「SQLを返せる範囲」を広げるのではなく、誤ったSQLを返さない境界を狭く正確にした。

Interpretationとして、この設計はLLMと競争するためではなかった。LLMなら文脈から妥当そうな関係を補えることがある。一方、engineの役割は、証明できない関係を補わないことに置かれた。便利さよりも、candidate SQLを実行する人が誤った前提を受け取らないことを優先した。

## 3. 10 toolで、作ることを一度止めた

10 toolが揃うと、次に何を追加できるかは容易に思いついた。output column単位のslicingも候補だった。parserやlineageをさらに強化する案もあり得た。

ここで問いが変わり始めた。「実装できるか」ではなく、「本当に必要か」をProduct Gateで確認することにした。10 toolを代表的なworkflowへ当て、keep、questionable、consolidation candidateに分類した。

Observedとして、最終判定は`done / current-10-tools-sufficient`だった。10 toolはすべて残り、統合候補も削除候補もなかった。一方、Phase 4Cのoutput-column slicingは、作れないからではなく、具体的な利用阻害の証拠が足りないためdeferredになった。既知CTEをすぐ取り出す`extract_cte_query`も、他のtoolで理論上代替できるだけでは削除しなかった。実workflowのshortcutとして独立した価値があったからだ。

この時点で得たInterpretationは、「作れるから作る」を止めることも設計の一部だということだった。catalogを増やすほど、agentが選ぶ対象は増え、schemaとcontextの負担も増える。機能追加は無料ではない。

ただし、Product Gateが証明したのはcatalog内の責務とcapabilityである。agentが自然に使うことまでは証明していなかった。

## 4. 最初のblack-box dogfoodingで予想が外れた

次のHypothesisは、MCPを利用可能にしたagentは、複雑なSQL調査で自然にrawsql toolを選び、MCPなしより良い回答を返す、というものだった。tool名や攻略法は教えず、MCPあり・なしの条件で比較した。

Observedは期待と違った。平均回答品質はほぼ同じだった。MCPが明確に良かったscenarioは0。rawsql MCPが役立つと見込んだ8 scenarioのうち、実際に使われたのは1つだけだった。agentはSQLとDDLをshellで読み、自力でかなり良い回答を作った。simple CTE、query contract、joinによるaggregate重複などは、専用AST toolがなくても説明できた。

ここで「LLMは想像していた以上に、すでにSQLを読める」という観測を受け入れる必要があった。MCPを作れば使われる、使われれば回答が良くなる、という二段階の仮説はどちらも支持されなかった。

さらに、唯一使われたcross-file impact searchでは5回のcallが発生した。exact column searchだけで主要な答えは得られていたのに、agentはunqualified columnへ広げ、owner tableを確認し、decoy tableをschemaあり・なしで再検索した。toolを使ったこと自体は成功でも、5回使ったことは成功ではない。1回の決定的な検索を、探索的な往復へ変えてしまえば、latencyとcontextは増える。

そして`slice_query`は、Codex CLIがinput schemaをmaterializeできず、tool catalogから除外されていた。agentが使わなかったのではなく、使える形で見えていなかった。tool selectionの評価以前に、host compatibilityの問題が混ざっていた。

この時点で、AST解析MCPは要らないのではないか、という疑問が現実的になった。これは結論ではなく、その時点のHypothesisである。モデルが進歩すれば、context augmentationのためだけのtoolは価値が薄れるかもしれない。ORMの抽象化価値がLLMによるcode generationで変わるのではないか、という類推も浮かぶ。ただし、Context7やORMの将来についてrawsql-tsの実験が証明したわけではない。ここで確認したのは、限られたSQL調査ではLLMの直接読解が予想以上に強かった、ということだけである。

## 5. 問いを「賢さ」から「computation」へ変えた

最初の問いは、「MCPでLLMをより賢くできるか」だった。しかしblack-box dogfoodingの後、その問いを続けてもモデル能力との競争になる。そこで問いを変えた。

LLMが十分に賢いとしても、決定論的処理を外部化する価値はあるか。

Durable Value Evaluationでは、自然利用とdirect capabilityを分けた。agentがtoolを選ぶかどうかと、toolを選んだときにengineが何を提供できるかを同じ試験にしなかった。

Observedとして、semantic grepは30、300、1500 SQL filesでrecallとprecisionが100%だった。1500 filesでもsub-secondで、同じ入力の結果はbyte-identicalだった。DDL-backed ownershipは500 tablesでも安定した。safe transformは同じSQLを繰り返し返し、不明なboundaryではSQLを生成しなかった。直接MCP 108 callsではcontract errorが0だった。

fixture extractionでは、差がよりはっきりした。自然回答のagentはjoin columnからrelationを推測し、6回中4回を`done`と判断した。rawsql-tsは物理FKがないことを証拠不足として扱い、`partial`で止まった。LLMは賢いので、もっともらしい関係を補える。engineは、証明できないことを拒否できる。この差は「どちらがSQLをよく理解するか」ではない。

一方、natural-use 18 runsではrawsql callは再び0だった。MCPを利用可能にしただけでinput tokensは12.6%増えた。full lineageや1500-file detail resultは、元のinputより大きいcontextを生むこともあった。

Interpretationとして、engineのdurable valueは示されたが、MCP adapterの価値は示されなかった。rawsql-ts本体とMCP integrationを同一視してはいけない。engineが失敗したのではなく、engineの価値をAIへ届けるinterfaceがまだ成立していない、というのが現在地だった。

## 6. integrationを直す有限ループ

次は新機能を作らず、host compatibility、discoverability、context efficiencyだけを最大6 iterationで改善することにした。改善しなければrevertし、2回連続で採用可能な改善がなければ止める。devとholdoutを分け、ground truthとnatural promptのhashを最初に固定した。

評価装置自体も最初からうまくはいかなかった。baseline runnerは120秒で終了し、15反復中2件だけを残して止まった。完了済みrunを壊さず再開する機能を追加した。遠回りではあるが、反復実験では部分完了から同じ条件へ戻れることもevidence integrityの一部だった。

BaselineのObservedは、positive 12 runsでrawsql selectionが0、`slice_query` materialization warningが70件だった。まずtuple-rest selectorが生成したJSON Schemaを調べると、pathの`items`がschema objectではなくarrayになり、`additionalItems`を伴っていた。Codexの`invalid type: map, expected a string`と対応していた。

Iteration 1では、runtime selector contractを変えず、公開schemaだけをsingle-item-schema arrayへ変えた。rootが先頭に一度だけ現れる制約はruntime validationで残した。Observedとしてhost warningは70から0になった。これは明確な改善だった。しかしrawsql selectionは0のままだった。Callableにはなったが、Discoverableにはならなかった。

Iteration 2では、各toolのdescriptionをuse-when中心へ変え、read-onlyやidempotentのannotationを加えた。結果はselection 0のまま、1 runで汎用resource一覧を呼び、48 KBの結果をcontextへ追加した。平均input tokensも増えた。説明を増やせば選ばれるというHypothesisは棄却し、変更をrevertした。

Iteration 3では、個別descriptionを元へ戻し、短いserver instructionsだけを試した。local、offline、static、no DB、summary-firstという全体像をMCP initializationで伝えた。しかしselectionは変わらなかった。これもrevertした。採用可能なdiscoverability改善が2 iteration続けて得られなかったため、予定どおり停止した。

最後のholdoutでも、host warningは0、negative workloadで不要callも0だったが、positive 3 runsでrawsql selectionは0だった。結果を見た後の調整はしていない。

最終判定は`done / partial-integration-improvement`である。`slice_query`がhostから消える問題は直った。自然選択、speed advantage、context advantageは未達だった。失敗を言い換えて成功にするなら、また同じ問いを繰り返すことになる。

## 7. 現時点で見えている境界

ここまでのObservedから、small SQLの説明、ordinary reasoning、simple CTE、単純なcontract reviewはLLMに向いている。毎回AST toolを呼ぶ必要はない。negative controlでtoolを呼ばないことは、正しい選択である。

deterministic engineの利点が見えたのは、large corpusを漏れなく検索する処理、巨大DDLからownershipを照合する処理、同一結果を再現する処理、安全を証明できないtransformを拒否する処理だった。これらはfaster、exhaustive、reproducible、fail-closed、embeddableという性質で価値を持つ。

これは固定的な境界ではない。モデルもhostも変わる。現時点のevidenceに基づく境界である。特にMCP natural integrationは未解決で、engineの速度やcontext advantageがagent workflowへ自動的に移るわけではない。

## 8. 賢さで競わない

「賢さで競う時代は終わった」という言い方をするなら、その意味は、libraryが不要になったということではない。「LLMよりSQLを理解できます」だけを価値にするのが弱くなった、という意味である。

知能の補完は腐りやすい、というHypothesisがある。モデルが苦手な構文を説明するだけのtoolは、次のモデルで差が縮むかもしれない。一方、computationは残りやすいかもしれない。すべてのfileを走査する、同じ規則を毎回適用する、外部schemaと照合する、制約を満たさなければ出力を拒否する、といった仕事は、モデルの理解力と直接競争しない。

promptで再実装できることと、毎回そうするのが合理的であることも違う。LLMに巨大DDLを読ませ、同じ安全規則をpromptで再現させることは可能かもしれない。しかしcontext、時間、再現性、fail-closed behaviorまで含めると、固定engineをprogramやCIから利用する価値は残る。MCPは、そのengineをAIへ公開するadapterになり得る。ただし「なり得る」と「今回なった」は区別しなければならない。

## 9. 失敗から残ったもの

最初のdogfoodingではMCPの実用価値を証明できなかった。10 toolを作ったのに、多くのagentは使わなかった。MCPありの方がtokenを消費した。host compatibilityのために1 toolがcatalogから消えた。評価oracle自身もoptional-condition safetyを誤り、評価する側も無謬ではないことが分かった。integration loopではdescriptionを良くしたつもりが、resource探索とcontext増加を招いた。

それでも残ったものがある。large corpusに対する正確で高速な検索、DDL-backed ownership、byte-stable transform、unsafe SQLを返さないslice、証拠不足で止まるfixture planである。そして、自然利用で価値が出ていないなら新toolを増やさない、というProduct Gateの判断も残った。

現在の次の一手は、新しいfeatureを想像して作ることではない。実利用で既存10 toolsでは解けない具体的な問題、あるいは必要なtoolが選ばれずworkflowが止まる具体的なtraceが現れたとき、そのevidenceから最小の変更を考えることである。

## Key lessons

### What surprised us

LLMはsmallからmediumなSQLを、専用toolなしでも予想以上に高品質に読めた。toolを利用可能にするだけでは、agentはdeterministic engineを自然選択しなかった。

### What failed

「MCPにすれば使われる」「説明を増やせば選ばれる」「toolを使えば回答が良くなる」という仮説は、今回のnatural-use evidenceでは支持されなかった。

### What survived

exhaustive search、DDL matching、reproducibility、安全な変換、fail-closed generationというengineの価値はdirect evaluationで残った。`slice_query`のhost compatibilityも修正できた。

### What remains unresolved

engineのspeedとcontext advantageを、agentが必要な場面で自然に選ぶintegrationへどう接続するかは未解決である。現時点では追加機能の根拠ではなく、次のreal workflow evidenceを待つ問いとして残す。
