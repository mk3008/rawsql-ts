# Codex task tracking and handoff

The former requirement to use the globally installed `minimal-orchestration`
skill is retired. Do not require its installation, role protocol, run ledger,
state transitions, Runtime Adjudicator packets, or generated progress views
to start or continue work. Its absence is not a blocker.

Keep repository-specific impact assessment, routing, verification, review,
and reporting in `rawsql-task-orchestrator` and its specialist skills. Maintain
`tmp/PLAN.md` for multi-step work as required by the planning guidance. For
delegated work, record the objective, scope, base revision, owning task or
worker, acceptance criteria, verification evidence, blockers, and next action
in that plan or the existing authoritative task record. Retain existing worker
reports and run records as historical task evidence; do not rewrite them.

This retirement does not change security constraints, branch isolation,
authorization for external actions, required checks, review gates, or human
approval for merge, release, and deployment.
