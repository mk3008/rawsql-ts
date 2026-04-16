# Package Scope
- Applies to the starter telemetry template files.
- Defines repository telemetry seams and adapters.

# Policy
## REQUIRED
- Telemetry hooks MUST remain replaceable by application-owned wiring.
- Default telemetry behavior MUST stay conservative about query text emission.

## PROHIBITED
- Making telemetry mandatory for non-persistence layers.

# Mandatory Workflow
- Telemetry changes MUST run the focused scaffold verification tests.
