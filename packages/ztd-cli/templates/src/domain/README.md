# Domain

Domain types, invariants, and business rules live here.

- Do not import SQL files, QuerySpecs, or ZTD-generated artifacts into this layer.
- Prefer ports or plain interfaces for dependencies on application or infrastructure code.
- If you need a persistence example, follow `tests/queryspec.example.test.ts` instead of adding SQL here.
