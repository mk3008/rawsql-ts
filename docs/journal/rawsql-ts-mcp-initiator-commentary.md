# rawsql-ts MCP 起案者コメント

この文書は、[開発 chronology](./rawsql-ts-mcp-chronology.md) と
[開発記](./rawsql-ts-mcp-engineering-journal.md) を、
実装者ではなく「この取り組みを起案し、評価の問いを投げた側」から振り返るためのコメントである。

Codexの開発記が主に「何を作り、何を観測し、どう直したか」を記録しているのに対し、
ここでは「その結果をどう受け止め、なぜ次の問いへ進んだのか」を残す。

後知恵で成功物語に書き換える意図はない。
むしろ、途中で仮説が何度も崩れたこと自体が、この開発の重要な成果だったと思っている。

---

## 1. 出発点は「使われるだろう」だった

rawsql-tsには、すでにSQLをASTとして解析する能力があった。
query structure、column lineage、CTE、依存関係、usage search、safe transformation。
これらをMCPとして公開すれば、LLMがSQLを調査するときに自然と利用され、
人間やLLMが毎回SQLを読み解くより、確実で効率的な調査ができるのではないか。

出発点はかなり素朴だった。

「LLMはSQLを読める。それでも、解析器が構造化した事実を渡せばもっと強くなるだろう」

という仮説である。

だから最初は、使われると思う機能をMCPへ順番に載せていった。
この時点では、MCPとして公開することと、agentがその価値を理解して使うことを、
かなり近いものとして考えていたと思う。

しかし、後から見ると、この二つはまったく別の問題だった。

---

## 2. 「作れるから作る」を止めたのは重要だった

10 toolまで増えた時点で、まだ追加案はいくらでもあった。
output column単位のsliceなど、技術的に面白い拡張も考えられた。

そこで[Product Gate](../dogfooding/mcp-product-gate-2026-08.md)を置き、
「実装できるか」ではなく「本当に必要か」で止めたことは大きかった。

[Product Decision](../dogfooding/mcp-product-decision-2026-08.md) では
`done / current-10-tools-sufficient`となり、
Phase 4Cは「作れないから」ではなく「必要性の証拠が足りないから」止まった。

この判断がなければ、その後も機能を増やし続けていた可能性がある。
しかし、後のdogfoodingで分かったのは、
問題は機能不足ではなく「そもそも使われない」ことだった。

機能追加を止めていたからこそ、
この事実を正面から見ることができたと思う。

---

## 3. 最初のdogfoodingは、かなり予想外だった

[最初のAgent Dogfooding](../dogfooding/mcp-agent-dogfooding-2026-08.md) では、
rawsql-ts MCPを利用可能にすれば、
複雑なSQL調査でagentが自然にtoolを使い、
MCPなしより良い回答になると予想していた。

結果はほぼ逆だった。

MCPが明確に良かったscenarioはなく、
有用だと見込んだscenarioでもほとんど使われなかった。
そして、使わなくてもLLMはSQLやDDLをかなり正確に読んでいた。

ここで初めて、

「LLMのSQL理解力を過小評価していたのではないか」

という疑問が強くなった。

これはかなり重要な転換だった。

AST解析器ならLLMより確実だ、というだけでは弱い。
誤答率に差があったとしても、
LLMが実用上ほとんど困らない水準まで読めるなら、
「LLMよりSQLを理解できる」は長期的な差別化にはなりにくい。

一度は、AST解析MCPそのものが不要なのではないか、と考えるところまで行った。

Context augmentation系のtoolがモデル進化で価値を失うことがあるように、
rawsql-tsも「LLMの賢さを補助するだけ」のtoolなら、
同じ側にいるのではないかという疑いである。

この疑問を途中で打ち消さなかったことが、その後につながった。

---

## 4. 問いを「賢さ」から「computation」へ変えた

そこで問いを変えた。

> LLMをもっと賢くするためにSQL解析器が必要なのか。

ではなく、

> LLMが十分に賢いとしても、決定論的な処理を外部化する価値はあるのか。

という問いである。

[Durable Value Evaluation](../dogfooding/mcp-durable-value-evaluation-2026-08.md) で
見えたのは、まさにこの違いだった。

large corpusを漏れなく検索する。
大量DDLと機械的に突合する。
同じ入力から同じ結果を返す。
安全を証明できないscopeではSQLを生成しない。
物理FKが確認できなければrelationを推測しない。

これらは「SQLを理解できるか」という競争ではない。

LLMでも同じ結論へ到達できる場合はある。
しかし毎回LLMへ大量の入力を読ませ、
同じ規則を再構築させ、
漏れなく確認させ、
どこまで推測してよいかを判断させる必要はない。

ここで初めて、rawsql-tsの役割を

**LLMの知能補助ではなく、deterministic computationの外部化**

として見られるようになった。

「賢さで競う時代は終わった」という言い方をするなら、
ボクが意味しているのはライブラリが不要になったということではない。

**LLMより賢いことだけを価値にする時代は終わりつつある。**

速度、網羅性、再現性、安全境界、外部接続、固定された規則。
そういう、モデルの知能そのものとは別の価値を出す必要がある。

---

## 5. ただし、価値があっても使われなかった

Durable Value Evaluationではengine側の価値は見えた。
しかしnatural-useではrawsql-ts MCPが選ばれなかった。

そこで[integration improvement loop](../dogfooding/mcp-integration-iteration-journal-2026-08.md)を回した。

`slice_query`がCodex hostから消えていたJSON Schema問題は修正できた。
これは明確にserver側から改善できる問題だった。

一方で、tool descriptionを詳しくしても、
server instructionを追加しても、
自然選択率は改善しなかった。

ここで分かったのは、

**Callable、Discoverable、Economicalは別の問題**

だということだった。

toolが正しく存在する。
agentがその存在と意味を理解する。
agentがその場でnative shellよりtoolを選ぶ。
tool resultを必要最小限に使う。

このすべてが揃わなければ、
engineがどれだけ高速でもagent workflowでは価値が顕在化しない。

説明文を調整し続ければいつか使われる、という仮説も
有限ループの中で止められた。

これは失敗ではあるが、かなり重要な負の証拠だったと思う。

---

## 6. 最後に残っていた問いは「明示的に使わせたらどうなるか」だった

natural selectionが成立しないことと、
MCPを使う価値がないことは同じではない。

そこで最後に、

> MCPなし

と

> MCPあり + 「この調査ではrawsql-ts MCPを使って」と明示する

を比較した。

これはdiscoverabilityのテストではない。

「どういうpromptなら使われるか」を探ることもしなかった。
人間またはagent policyが「この仕事ではdeterministic SQL toolを使う」と判断した場合、
実際にend-to-endで何が起きるかを見た。

[Explicit-Use Value Evaluation](../dogfooding/mcp-explicit-use-value-evaluation-2026-08.md) の
主判定は `done / explicit-use-value-conditional` だった。

この結果で、ようやく最初の問いに実測を伴って答えられるようになったと思う。

---

## 7. 「なぜLLMがあるのにSQL解析するの？」への現在の答え

今なら、こう答える。

> **LLMがSQLを理解できないから、SQL解析器を使うのではない。**
>
> **LLMに毎回推論させる必要のない、網羅的・決定論的・fail-closedな処理を外部化するために使う。**

LLMはすでにsmallからmediumなSQLをかなりよく読める。
単純なSQLの説明、小さな既知CTE、普通のDDL ownership確認なら、
LLMだけで十分な場合が多い。

そのような仕事に毎回MCPを使わせる必要はない。

一方で、explicit-use evaluationでは、
semantic usage searchで30 / 300 / 1,500 filesのすべてについて
recall / precision 100%を維持しながら、
MCP条件はnative条件よりwall timeとinput tokenを削減した。

ここでは「ASTだから正しそう」ではなく、

**同じ網羅結果を、より少ないLLM workで得られた**

という意味がある。

safe query extractionではnative側も正しく判断できた。
それでもMCPには、
「証明できないboundaryならcandidate SQLを返さない」
という再利用可能なcontractがある。

fixture planningでは、
LLMがもっともらしいrelationやfixture valueを補完することがある一方、
engineは証拠不足を`partial`として残せた。

これも「どちらがSQLを理解しているか」という話ではない。

**推測してよい仕事と、証明できないなら止まるべき仕事を分けること**
に意味がある。

---

## 8. rawsql-ts MCPは「SQLを読むAI」ではない

現時点では、rawsql-ts MCPを次のように捉えるのが一番自然だと思う。

> **LLMにSQLを教えるためのtoolではない。**
>
> **LLMが必要なときに、決定論的なSQL computationへ処理を委譲するためのinterfaceである。**

だから、すべてのSQL taskへroutingするものでもない。

利用理由は明示できるべきだ。

- 多数のSQLを漏れなく意味的に横断したい
- 同じ規則で再現可能な結果が必要
- safe-onlyな変換を行いたい
- unprovenなquery boundaryではSQLを出してほしくない
- 証拠のないrelationを推測してほしくない

こういうときに使う。

逆に、

- 単純なSQLを説明してほしい
- 小さなCTEを一度読むだけ
- 通常のSQLレビュー
- LLMだけですでに十分に答えられる小規模調査

なら、使わないことも正しい。

この境界を示せるようになったことで、
rawsql-ts MCPはようやく「10個のSQL解析tool」から
「なぜ存在するのか説明できるtool」になったと思う。

---

## 9. まだ解けていない問題もはっきりした

explicit-use evaluationは成功物語ではない。

231 rawsql callsのうち、必要と評価されたものは106。
125 callsは冗長で、96 callsは再確認だった。

engine実行時間は全体から見れば非常に短いのに、
agent orchestrationと巨大なresult consumptionが多くの時間とcontextを使っている。

特にsemantic searchは、
1回のworkspace-wide callで十分な場面でも
agentが細かく再確認することがあった。

つまり、

**使わない問題を越えると、今度は使いすぎる問題が現れた。**

ただし、今ここで新しいtoolやschema redesignへ飛びつく必要はないと思う。

この問題は、rawsql-tsの解析能力不足ではない。
agent routing、call planning、summary/detail consumptionの問題である。

実利用で同じ問題が再現し、
改善の価値が十分に見えたときに改めて扱えばよい。

この開発では「作れるから作る」を止めること自体を何度も学んだ。

---

## 10. この開発で一番残したいこと

今回面白かったのは、最初の仮説がそのまま証明されたことではない。

むしろ、

> MCPにすれば使われるだろう\
> → 使われなかった\
> → LLMは思った以上にSQLを読めた\
> → AST解析自体が不要なのでは、と疑った\
> → 「賢さ」ではなく「computation」で問い直した\
> → engineには別の価値があると分かった\
> → それでも自然には使われなかった\
> → explicit routingすると、workload次第ではend-to-endの価値が出た\
> → ただしagentはtoolを使いすぎることも分かった

という、仮説が壊れるたびに問いを変えてきた過程である。

LLM時代のlibraryやdeveloper toolについて、
ここから一つ一般化するとしたら、現時点ではこう考えている。

> **「LLMより賢い」は寿命の短い価値になりやすい。**
>
> **LLMが賢くなっても残る、計算・網羅性・再現性・安全境界・外部接続を持てるかが重要になる。**

rawsql-ts MCPがその答えの完成形だとはまだ思っていない。

しかし少なくとも、
「なぜLLMがあるのにSQL解析器を使うのか？」
という最初の問いには、
開発当初よりずっと具体的な答えを持てるようになった。

**LLMには考えてほしいことを考えてもらう。\
計算で確定できることは、計算へ任せる。**

rawsql-ts MCPの現在の価値は、
その境界をAI agentから利用できるようにすることにある。

---

## 関連記録

- [rawsql-ts MCP 開発 chronology](./rawsql-ts-mcp-chronology.md)
- [MCPを作ったらLLMに使ってもらえなかった話](./rawsql-ts-mcp-engineering-journal.md)
- [MCP Product Gate Evidence](../dogfooding/mcp-product-gate-2026-08.md)
- [MCP Product Decision](../dogfooding/mcp-product-decision-2026-08.md)
- [MCP Agent Dogfooding](../dogfooding/mcp-agent-dogfooding-2026-08.md)
- [MCP Durable Value Evaluation](../dogfooding/mcp-durable-value-evaluation-2026-08.md)
- [MCP integration improvement iteration journal](../dogfooding/mcp-integration-iteration-journal-2026-08.md)
- [MCP Explicit-Use Value Evaluation](../dogfooding/mcp-explicit-use-value-evaluation-2026-08.md)
