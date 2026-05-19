---
title: Mapping and validation order
---

# Mapping and validation order

The standard generated path maps database rows with AOT generated row mappers.
Runtime mapper libraries and runtime DB row validators are not part of the default generated runtime.

Recommended order:

```text
SQL driver row
  -> generated AOT row mapper
  -> boundary/application validation when explicitly needed
```

Keep each responsibility separate:

| Stage | Responsibility |
|-------|---------------|
| Generated row mapper | Column-to-DTO projection and generated aggregation |
| Boundary validation | Request/response validation when the application needs it |
| ZTD-backed tests | SQL, fixture, and mapper behavior proof |

Avoid adding validator transforms that duplicate generated mapping behavior.
