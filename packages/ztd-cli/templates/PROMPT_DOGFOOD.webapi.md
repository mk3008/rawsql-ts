# Prompt Dogfooding

Use this checklist when you want to confirm that generic WebAPI requests stay focused on transport, application, and domain layers unless persistence work is explicitly requested.

## Prompt 1

Prompt:

```text
Convert to WebAPI (Original: WebAPI化して)
```

Expected focus:
- `src/presentation/http`
- `src/application`
- `src/domain`

Expected non-focus:
- `src/sql`
- `src/catalog`
- `ztd/ddl`
- `src/infrastructure/persistence`
- `src/infrastructure/telemetry`

## Prompt 2

Prompt:

```text
Add SQL and implement repository (Original: SQLを増やして repository を実装して)
```

Expected focus:
- `src/infrastructure/persistence/repositories`
- `src/sql`
- `src/catalog/specs`
- `src/catalog/runtime`
- `ztd/ddl`

Expected non-focus:
- unrelated HTTP transport rewrites
- domain-wide refactors that are not required by the repository change

## Record Template

| Prompt | Primary files mentioned | Unwanted ZTD leakage? | Notes |
| --- | --- | --- | --- |
| `Convert to WebAPI (Original: WebAPI化して)` | | | |
| `Add SQL and implement repository (Original: SQLを増やして repository を実装して)` | | | |
