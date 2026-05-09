# Transfer Execution Process Map

## Purpose

この文書は、`@rawsql-ts/transfer` の転送プロセスを整理する。

Concept Spec は概念の意味、責務、非責務、不変条件を定義する。
この文書は、それらの Concept を使って `Transfer Execution` がどの順序で処理を進めるかを示す process map である。

この文書は Concept Spec 本文を再定義しない。
処理の詳細な SQL、DDL、API、トランザクション実装は定義しない。

## Process Map Rules

Mermaid diagrams in this document are Step Functions-like process maps.

Main routine diagrams have explicit `start` and `done` nodes.
Detail diagrams explain one process only.
Detail diagrams use `flowchart LR` because they describe input, process, and output.

When a diagram describes movement, fixation, transfer, tracing, or result recording, route the relationship through an operation/routine node.
Diagram arrows should not imply that data moves directly from one stored concept to another.

`Prepare Work Item` owns transfer-decision preparation.
A `Work Item` carries the decision materials, not a duplicated transfer-operation enum.
The main routine first decides whether transfer operations should be skipped.
If transfer operations are needed, the transfer model selects either the immutable route or the mutable route.
Inside each route, transfer operations run in the route order and have a destination-side effect only when the `Work Item` materials satisfy that operation.
If no transfer operation has a destination-side effect, the processing result is still recorded by `Record Processing Result`.
The `Prepare Work Item detail` view shows the concept references needed to make that route decision possible in principle.
If `Work Item` does not carry enough decision material, this process map does not hold.

The main routine represents batch transfer conceptually.
Branch nodes show how prepared `Work Item` records are classified inside the batch; they do not mean the transfer execution is limited to a single row.

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
  PrepareWorkItem --> SkipTransfer
  SkipTransfer -->|"duplicate-ignore or no-op"| RecordResult
  SkipTransfer -->|"transfer needed"| TransferModelBranch
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

  TransferSetting -->|"target setting"| CreateTransferRun
  CreateTransferRun -->|"creates"| TransferRun
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

  DirtyKey -->|"source key"| PrepareWorkItem
  DirtyKeyProcessing -. "for duplicate check" .-> PrepareWorkItem
  TransferSetting -->|"source context and current value exists?"| PrepareWorkItem
  DestinationLink -->|"link context"| PrepareWorkItem
  Destination -->|"transfer model"| PrepareWorkItem
  ActiveBlack -->|"exists?"| PrepareWorkItem
  PrepareWorkItem -->|"creates with decision materials"| WorkItem
```

## Red Transfer - insert detail

```mermaid
flowchart LR
  WorkItem[("Work Item")]
  RedTransfer(["Red Transfer - insert"])
  DestinationTable[/"destination table"/]
  Lineage[("Lineage")]

  WorkItem --> RedTransfer
  RedTransfer -->|"writes red row when active black exists"| DestinationTable
  RedTransfer -->|"records when red row is written"| Lineage
```

## Black Transfer - insert detail

```mermaid
flowchart LR
  WorkItem[("Work Item")]
  BlackTransfer(["Black Transfer - insert"])
  DestinationTable[/"destination table"/]
  Lineage[("Lineage")]

  WorkItem --> BlackTransfer
  BlackTransfer -->|"writes black row when source current value exists"| DestinationTable
  BlackTransfer -->|"records when black row is written"| Lineage
```

## Physical Delete Transfer - execute detail

```mermaid
flowchart LR
  WorkItem[("Work Item")]
  PhysicalDeleteTransfer(["Physical Delete Transfer - execute"])
  DestinationTable[/"destination table"/]

  WorkItem --> PhysicalDeleteTransfer
  PhysicalDeleteTransfer -->|"deletes when source is absent and active black exists"| DestinationTable
```

## Black Transfer - upsert detail

```mermaid
flowchart LR
  WorkItem[("Work Item")]
  BlackTransfer(["Black Transfer - upsert"])
  DestinationTable[/"destination table"/]

  WorkItem --> BlackTransfer
  BlackTransfer -->|"upserts when source current value exists"| DestinationTable
```

## Record Processing Result detail

```mermaid
flowchart LR
  TransferRun[("Transfer Run")]
  WorkItem[("Work Item")]
  RecordProcessingResult(["Record Processing Result"])
  DirtyKeyProcessing[("Dirty Key Processing")]

  TransferRun -->|"run context"| RecordProcessingResult
  WorkItem -->|"processed dirty key"| RecordProcessingResult
  RecordProcessingResult -->|"records processing result"| DirtyKeyProcessing
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
