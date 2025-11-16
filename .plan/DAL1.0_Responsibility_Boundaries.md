# DAL1.0 Responsibility Boundaries

## Core Principle

In DAL1.0, **responsibility boundaries are strictly defined** to prevent confusion between the library’s behavior and the user’s environment.  
This model intentionally differs from traditional ORM/testkit assumptions, and misunderstanding these boundaries is a common source of errors.

---

## 1. Database Connection Responsibility

### **What DAL1.0 *does not* do**
- Does **not** control, override, or protect database connection destinations.
- Does **not** enforce separate development / staging / production endpoints.
- Does **not** automatically block connections to real databases.
- Does **not** add safety gates such as “only connect when a flag is enabled.”

### **What the *user* controls**
- The database connection string (development, production, local, Docker, remote, etc.).
- Whether test/demo code should connect to an actual database.
- Any use of environment variables such as `.env`, secrets, toggles, or CLI flags.

### **Why?**
Connection strategy is an environmental decision, not a library decision.  
DAL1.0 respects user autonomy and does not interfere.

---

## 2. Unit Test Safety Guarantees

### **The only guarantee the library provides**
> **Unit tests must never depend on or mutate physical database tables.**

DAL1.0 enforces this by:

- Using fixture-backed CTE injection for SELECT.
- Using SELECT-derived CUD rewrites (INSERT … SELECT) during validation.
- Performing all schema checks using in-memory `TableDef` snapshots.
- Prohibiting any reliance on `information_schema`, `pg_catalog`, or live schema introspection.

### **What the library guarantees**
- Unit tests remain deterministic and table-independent.
- No physical table reads are needed.
- No physical table writes are performed.
- No developer environment can break other developers’ tests.

### **What the library does NOT guarantee**
- It does **not** restrict the user's ability to connect to real DBs outside the pipeline.
- It does **not** sandbox or isolate connections.
- It does **not** block or warn about using production URLs.

---

## 3. Demo / Integration Tests

### **User-owned responsibility**
- User decides **when** to run demo tests requiring real Postgres.
- User decides **whether** to enable Docker or external Postgres.
- User explicitly opts into environment setup.

### **DAL1.0 responsibility**
- None.  
- The library does *not* gate or protect demo runs.

### **Rationale**
Demo tests are intentionally *opt‑in* and environment-dependent.  
Library-level safety gates would conflict with DAL1.0’s responsibility boundaries.

---

## 4. Schema Responsibility (`TableDef`)

### DAL1.0 responsibilities
- Use `TableDef` snapshots as the **only schema source**.
- Do not query or infer live database schema.
- Keep schema validation fully deterministic and local.

### User responsibilities
- Provide/update TableDef snapshots.
- Choose storage format (TS/JSON/generated).
- Ensure consistency with actual DB schema (via scripts or tooling).

---

## 5. Summary of Boundaries

| Responsibility | DAL1.0 | User |
|----------------|--------|------|
| Choose DB connection target | No | Yes |
| Automatically protect against real DB connections | No | Yes |
| Ensure unit tests don’t touch physical tables | Yes | No |
| Provide in-memory schema (`TableDef`) | Yes | No |
| Schema lookups during tests (live DB usage) | No | Yes |
| Run demo tests | No | Yes |
| CAST / CUD validation behavior | Yes | No |

---

## 6. Guiding Statement

**DAL1.0 guarantees test isolation, not connection protection.  
Connection choice and environment safety are entirely the user’s responsibility.**

This separation is intentional and must be preserved to avoid repeating traditional ORM misdesigns.

---

## 7. Why misunderstandings happen

- Most ORMs *do* enforce environment rules → DAL1.0 deliberately *does not*.
- Traditional frameworks treat “test database” as a special mode → DAL1.0 does not.
- DAL1.0 focuses on **SQL logic correctness**, not **environment correctness**.
- Developers often assume unit-test frameworks should protect DB connections → DAL1.0 rejects this assumption.

To avoid mistakes in future sessions, always refer back to this responsibility model before adding new behavior or flags.
