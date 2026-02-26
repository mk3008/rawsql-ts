# Testkit Core Design Notes

## Role and Boundaries
- Defines design intent for DBMS-agnostic rewrite behavior in `packages/testkit-core`.
- Keeps rewrite, fixture, and schema resolution concerns in core while adapters own driver wiring.

## Non-Goals
- Replacing adapter responsibilities.
- Treating physical DB state as authoritative test state.

## ZTD Intent
- Core rewriter models fixture state as authoritative execution state.
- Real DB engines are execution backends for rewritten SELECT, not mutation targets.

## Rewrite Intent
- AST-first flow is the primary mechanism.
- Fallback regex exists only as a temporary compatibility path.
