# Codex orchestration adapter

For work requiring delegation, recovery, stale handling, or durable progress,
use the globally installed `$minimal-orchestration` skill. It is the authority
for Root, Worker, and Runtime Adjudicator roles, state transitions, task
packets, recovery, and generated progress views.

Keep repository-specific impact assessment in `rawsql-task-orchestrator` and
its specialist skills. Before dispatch, create the run ledger at
`tmp/orchestration/<run-id>/ledger.json`, render its derived progress files,
and retain existing worker reports as task evidence. Do not duplicate the
global role protocol or hand-edit generated progress views in this repository.
