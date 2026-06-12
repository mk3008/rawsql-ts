# Transfer Execution Process Map

## Purpose

この文書は、`@rawsql-ts/transfer` の転送プロセスを整理する。

Concept Spec は概念の意味、責務、非責務、不変条件を定義する。
この文書は、それらの Concept を使って `Transfer Execution` がどの順序で処理を進めるかを示す process map である。

この文書は Concept Spec 本文を再定義しない。
処理の詳細な SQL、DDL、API、トランザクション実装は定義しない。

## Process Map Rule Reference

This document follows the shared [Process Map Rules](/guide/concept-spec-overview#process-map-rules).
<!-- rule-source: concept-spec-overview.md#process-map-rules -->

## Diagram Legend

```mermaid
flowchart LR
  Record[("Record / storage")]
  State(["State machine / process"])
  CurrentState{{"Current-state index"}}
  ExternalTable[/"External physical table"/]
```

## Transfer Execution Main

```mermaid
flowchart TD
  Start(["start"])
  CreateRun(["Create Transfer Run"])
  PrepareWorkItem(["Prepare Work Item"])
  ApplyDecision(["Apply Transfer Target Decision"])
  SkipTransfer{{"Skip Transfer?"}}
  TransferModelBranch{{"Transfer Model Branch"}}
  RedTransfer(["Red Transfer - insert"])
  BlackTransferInsert(["Black Transfer - insert"])
  PhysicalDeleteTransfer(["Physical Delete Transfer - execute"])
  BlackTransferUpsert(["Black Transfer - upsert"])
  RecordResult(["Record Processing Result"])
  Done(["done"])

  Start --> CreateRun
  CreateRun --> PrepareWorkItem
  PrepareWorkItem --> ApplyDecision
  ApplyDecision --> SkipTransfer
  SkipTransfer -->|"重複無視または no-op"| RecordResult
  SkipTransfer -->|"転送が必要"| TransferModelBranch
  TransferModelBranch -->|"immutable model"| RedTransfer
  RedTransfer --> BlackTransferInsert
  BlackTransferInsert --> RecordResult
  TransferModelBranch -->|"mutable model"| PhysicalDeleteTransfer
  PhysicalDeleteTransfer --> BlackTransferUpsert
  BlackTransferUpsert --> RecordResult
  RecordResult --> Done
```

## Create Transfer Run detail

```mermaid
flowchart LR
  TransferSetting["Transfer Setting"]
  CreateTransferRun(["Create Transfer Run"])
  TransferRun[("Transfer Run")]

  TransferSetting -->|"対象の転送設定"| CreateTransferRun
  CreateTransferRun -->|"作成する"| TransferRun
```

## Prepare Work Item detail

```mermaid
flowchart LR
  DirtyKey[("Dirty Key")]
  DirtyKeyProcessing[("Dirty Key Processing")]
  TransferSetting["Transfer Setting"]
  DestinationLink["Destination Link"]
  Destination["Destination"]
  ActiveBlack{{"Active Black"}}
  WorkItem[("Work Item")]
  PrepareWorkItem(["Prepare Work Item"])

  DirtyKey -->|"source key 情報"| PrepareWorkItem
  DirtyKeyProcessing -. "重複判定用" .-> PrepareWorkItem
  TransferSetting -->|"転送元文脈と現在値の有無"| PrepareWorkItem
  DestinationLink -->|"宛先別文脈"| PrepareWorkItem
  Destination -->|"転送モデル"| PrepareWorkItem
  ActiveBlack -->|"存在有無"| PrepareWorkItem
  PrepareWorkItem -->|"判断材料を付けて作成"| WorkItem
```

## Apply Transfer Target Decision detail

```mermaid
flowchart LR
  WorkItem[("Work Item")]
  DestinationLink["Destination Link"]
  Destination["Destination"]
  ActiveBlack{{"Active Black"}}
  TransferTargetDecision(["Apply Transfer Target Decision"])
  DecisionResult[("Transfer Target Decision Result")]

  WorkItem -->|"判定対象"| TransferTargetDecision
  DestinationLink -->|"比較対象外列と宛先別文脈"| TransferTargetDecision
  Destination -->|"転送モデル"| TransferTargetDecision
  ActiveBlack -->|"存在有無"| TransferTargetDecision
  TransferTargetDecision -->|"転送要否と転送表現候補"| DecisionResult
```

## Red Transfer - insert detail

```mermaid
flowchart LR
  WorkItem[("Work Item")]
  RedTransfer(["Red Transfer - insert"])
  DestinationTable[/"destination table"/]
  Lineage[("Lineage")]

  WorkItem --> RedTransfer
  RedTransfer -->|"判定結果が赤伝転送候補の場合に赤伝行を書き込む"| DestinationTable
  RedTransfer -->|"赤伝行を書き込んだ場合に記録する"| Lineage
```

## Black Transfer - insert detail

```mermaid
flowchart LR
  WorkItem[("Work Item")]
  BlackTransfer(["Black Transfer - insert"])
  DestinationTable[/"destination table"/]
  Lineage[("Lineage")]

  WorkItem --> BlackTransfer
  BlackTransfer -->|"判定結果が追加転送候補の場合に黒伝行を書き込む"| DestinationTable
  BlackTransfer -->|"黒伝行を書き込んだ場合に記録する"| Lineage
```

## Physical Delete Transfer - execute detail

```mermaid
flowchart LR
  WorkItem[("Work Item")]
  PhysicalDeleteTransfer(["Physical Delete Transfer - execute"])
  DestinationTable[/"destination table"/]

  WorkItem --> PhysicalDeleteTransfer
  PhysicalDeleteTransfer -->|"判定結果が物理削除転送候補の場合に削除する"| DestinationTable
```

## Black Transfer - upsert detail

```mermaid
flowchart LR
  WorkItem[("Work Item")]
  BlackTransfer(["Black Transfer - upsert"])
  DestinationTable[/"destination table"/]

  WorkItem --> BlackTransfer
  BlackTransfer -->|"判定結果が更新転送候補の場合に追加または更新する"| DestinationTable
```

## Record Processing Result detail

```mermaid
flowchart LR
  TransferRun[("Transfer Run")]
  WorkItem[("Work Item")]
  RecordProcessingResult(["Record Processing Result"])
  DirtyKeyProcessing[("Dirty Key Processing")]

  TransferRun -->|"実行文脈"| RecordProcessingResult
  WorkItem -->|"処理した Dirty Key"| RecordProcessingResult
  RecordProcessingResult -->|"処理結果を記録する"| DirtyKeyProcessing
```

## Active Black Example

Active Black は、Red Transfer する場合にどの黒伝を符号反転対象にするかを示す。

```text
black 1: +100
```

この場合、`1` が active。

```text
black 1: +100
red 2: -100
```

この場合、active はない。

```text
black 1: +100
red 2: -100
black 3: +150
```

この場合、`3` が active。

この例はプロセス理解のための説明であり、Active Black の Concept Spec 本文ではない。
