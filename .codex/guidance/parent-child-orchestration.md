---
name: parent-child-orchestration
description: Connect independent Codex worker tasks to rawsql-ts planning, verification, review, and acceptance gates without replacing applicable package skills.
---

# Parent-child Codex Task Protocol

Use this protocol only after `$rawsql-task-orchestrator` has classified a rawsql-ts task that benefits from an independent user-owned Codex worker task. Apply the installed common skills `$async-orchestration-dispatch`, `$orchestration-knowledge-handoff`, and `$orchestrator`; this document defines only the repository-local connection points.

Existing repository gates always win. This protocol does not make a worker report, notification, or parent acknowledgement equivalent to verification, two-cycle review, retro clearance, PR readiness, or human acceptance.

## Ownership and state

| Artifact | Owner and purpose | Lifetime / authority |
| --- | --- | --- |
| `tmp/PLAN.md` | Current task owner; active plan, assumptions, acceptance state, blockers, and material findings | Local working state; update while work is active |
| `tmp/RETRO.md` | Current task owner; meaningful recognition or verification misses and their prevention | Local task reflection; `open` items still gate review as defined by `pre-pr-retro-gate` |
| `tmp/orchestration/<task-id>/manifest.yaml` | Parent; dispatch record and model-selection evidence | Parent control artifact; retain until parent acceptance is recorded |
| `tmp/orchestration/<task-id>/report-attempt-<n>.yaml` | Child; self-contained evidence handoff | Durable task evidence; retain the worker worktree and report until parent acceptance and any correction cycle finish |
| `tmp/orchestration/<task-id>/parent-review-attempt-<n>.yaml` | Parent; acceptance decision referencing the child report | Parent decision record; it does not replace the child report |
| `AGENTS.md`, `.codex/guidance/`, `.agents/skills/` | Parent after evidence review and applicable gates | Durable reusable rules only; never use a task report as a substitute |

The report path in a notification must identify the actual worker-worktree file unambiguously. It may be absolute for task coordination; do not put local filesystem paths in GitHub-facing text.

## Parent dispatch

The parent owns the objective, impact assessment, routing, gate selection, integration, and final acceptance. Before dispatch, the parent writes a manifest with at least:

- `task_id`, parent and child thread identifiers when available, canonical base SHA, worktree, branch, and attempt number;
- objective, in-scope and out-of-scope surfaces, acceptance items, and stop conditions;
- required repository/package skills and the required verification and review gates;
- model and reasoning selection, justified only by task purpose, risk, affected surfaces, reversibility, and verification ease;
- expected durable report path and knowledge-promotion review owner.

Do not select a model from a task name or guessed implementation file. If a required model is unavailable, follow the existing orchestrator escalation rule rather than silently substituting one.

The child-facing brief is deliberately narrower than the parent manifest. It contains **only**:

1. purpose;
2. risk;
3. in-scope and out-of-scope boundaries;
4. acceptance criteria;
5. verification required;
6. stop conditions.

The parent must route a matching surface to its existing package-specific skill. In particular, QuerySpec product behavior and ZTD/rewrite, fixture, manifest, shadowing, or schema-drift work use `ztd-sql-unit-tests` or `ztd-ddl-sync-and-debug` as applicable. The protocol never copies, replaces, or relaxes those rules.

## Child execution and durable return

The child works only within the dispatched boundary, keeps its `tmp/PLAN.md` current, and uses `tmp/RETRO.md` for meaningful misses. It may report `ready_for_parent_review`, `blocked`, or `not_done`; it must not self-certify final acceptance.

Before notifying the parent, the child writes `report-attempt-<n>.yaml`. The report is the source of truth and includes:

- task and attempt identity, branch/base, objective, scope, and requested acceptance criteria;
- per-criterion `done`, `partial`, or `not done` attainment, repository evidence, supplementary evidence, and gaps;
- commands run and results, failed required checks with base-branch or prerequisite evidence when relevant, and remaining blockers;
- applicable skills and gates actually used, including any ZTD/QuerySpec evidence layer;
- changed files and non-goals confirmation;
- knowledge candidates separated into `durable_rule_candidate`, `task_evidence`, and `transient_note`, each with evidence and a proposed promotion target;
- recommended next action and whether correction is required in the same child thread.

Only after the file is complete, send one minimal wake-up message:

```text
[WORKER_REPORT v1] task_id=<task-id> attempt=<n> status=<ready_for_parent_review|blocked|not_done> report=<durable-report-path> worker_thread_id=<child-thread-id> next=<parent-review|same-thread-correction|human-decision>
```

The notification is not a second report. It contains only the versioned identity, status, report reference, child thread identity, and next action.

## Parent acceptance and correction

On notification, the parent reads the durable report and records a parent-review artifact. The parent must:

1. verify each requested acceptance item against repository evidence and apply the required verification rules, including the failed-check rule;
2. run or obtain the required independent verification and the existing consistency, concept-boundary, pre-PR retro, and human-acceptance review sequence;
3. reject unsupported attainment, unresolved blockers, missing package-skill routing, or an open retro item; and
4. accept, request correction, or escalate for a human decision with the evidence basis recorded.

For a correction, send the correction request to the **same child thread** and increment the attempt number. Preserve earlier reports and repeat affected implementation, verification, reporting, and review gates. Do not create a replacement child task merely to correct its own bounded deliverable.

The parent may promote a `durable_rule_candidate` only after checking its evidence and passing every affected repository gate. Promotion belongs in durable repository guidance or a routed existing skill; keep one-off evidence in the task report and reflection in `tmp/RETRO.md`.

## Conflict and closure

If this protocol conflicts with a narrower `AGENTS.md`, package policy, package-specific skill, required verification, review rule, or PR-readiness check, follow the existing stricter rule. Record the conflict in the parent review artifact and propose the smallest compatible clarification; do not weaken the existing gate during the task.

Parent acceptance closes only the child handoff. Overall task completion still follows the repository reporting and PR-readiness workflow, and push, pull-request creation, and merge require separate authorization.
