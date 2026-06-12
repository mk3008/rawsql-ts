# Transfer Review Authority Model

この文書は `@rawsql-ts/transfer` の review authority model である。

これは Concept Spec ではない。Concept Spec、DFD、Process Map、Technology Policy、Test Policy、generated review report を、誰が主体で扱うかを定義する。

## Purpose

Concept Spec 全体の思想は、AIやCLIを正本にすることではなく、人間が承認できる review harness を作ることである。

文書、AI review、CLI output はそれぞれ役割が異なる。役割を分けることで、AIが要件を勝手に確定したり、CLI生成物を仕様本文として扱ったり、レビュースキルの推論を人間承認なしに確定扱いすることを防ぐ。

## Authority Classes

### Human-owned Requirements

人間が主体で、AIはフォロー、整理、質問、提案を行う。

主な対象:

- Concept Spec
- DFD
- Process Map
- Scope Spec
- Issueや人間が明示した要件

AIの提案は review input であり、承認済み要件ではない。

### AI-led Review Management

AIが主体で、手順管理、比較、指摘、レビュー観点の適用を行う。人間は結果を承認または差し戻す。

主な対象:

- review skill の実行
- Concept / DFD / Process / DDL / Technology / Test Policy の横断レビュー
- review-plan の required reads に基づく確認
- 機械化できない矛盾、曖昧さ、責務境界の指摘

AIのレビュー結果は承認待ちの判断であり、Concept Specやpolicy本文を置き換えない。

### CLI-owned Review Views

CLIが主体で、構造化metadata、DDL、Concept/DFD/Process index、review-plan を入力に deterministic な review view を生成する。

AIはCLI outputを仕様としてではなく、機械的に再現可能な review input として読む。必要な場合に少しだけ推論を加え、人間が結果を承認する。

主な対象:

- Review Report
- VitePress generated pages
- `tmp/transfer-review-plan.json`
- metadata check output
- generated DDL / Concept / DFD / Process review pages

generated view は source of truth ではない。修正は source document または metadata に入れる。

## Review Usage

`authority-rules.json` は、この authority model をAIとCLIが参照しやすくするための機械可読review indexである。

`authority-rules.json` は仕様本文の代替ではない。
