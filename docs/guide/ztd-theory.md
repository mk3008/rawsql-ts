# Zero Table Dependency (ZTD) - Theoretical Overview

Zero Table Dependency (ZTD) is a new model that makes SQL unit testing, which has traditionally been difficult, practical by treating SQL like a pure function that does not depend on external state.

By evaluating SQL without reading from or writing to physical tables, ZTD eliminates many long-standing problems in SQL testing at their root.

## 1. Problems in SQL Unit Testing

Traditional SQL tests involve several forms of state management that make fast, deterministic, and parallel execution difficult:

- Migrations
- Seeding
- State cleanup
- Data conflicts and nondeterministic behavior during parallel execution

These problems arise because SQL depends on physical tables as external state.  
As long as a real database is used, these issues have largely been accepted as unavoidable, and very few people question them.

However, what SQL fundamentally operates on is not “tables” but “data.”  
A physical table is only one way of storing data, and it is not the only way to represent it.

In other words, it is theoretically possible to remove SQL's dependency on physical tables.  
If SQL can be evaluated without relying on physical tables, the major problems of SQL unit testing can be eliminated.

This operation of removing dependency on physical tables is what we call ZTD.

## 2. What ZTD Is

ZTD is a mechanism for evaluating SQL independently of physical tables, with the following characteristics:

- It uses a real database engine  
  The behavior of types, runtime logic, parsing, and parameter handling is identical to production.
- It never reads from or writes to physical tables  
  No side effects occur, and evaluation does not depend on external state.

As a result, constraints that were traditionally considered unavoidable can be removed completely:

- No migrations
- No seeding
- No cleanup
- No conflicts
- Fully deterministic test results

Furthermore, ZTD is designed to be applied dynamically to existing SQL.  
This makes it possible to run SQL unit tests without changing any source code.  
The speed of trial and error becomes far greater than with conventional approaches.

## 3. How ZTD Works

To evaluate SQL without depending on physical tables, ZTD combines the following four mechanisms:

- CTE Shadowing  
  Virtualizes reads from physical tables.
- Result-SELECT Query  
  Converts write operations into side-effect-free SELECT queries.
- Query Conversion  
  Parses and transforms SQL at the syntax level.
- SQL Interceptor  
  Intercepts SQL at runtime and applies transformations dynamically.

Each mechanism is described in the following sections.

### 3.1 CTE Shadowing

In CTE Shadowing, all table references are overridden by a CTE (common table expression) with the same name.  
As a result, even if a physical table exists, the query always refers to the CTE, and the physical table is completely hidden.

```sql
-- origin
select * from users;
```

```sql
-- ZTD
with users as (
  select 1::int as id, 'alice'::text as name
  union all
  select 2::int as id, 'bob'::text as name
)
select * from users;
```

Through this mechanism, reads from physical tables are virtualized by CTEs, and SQL always refers only to virtual tables.

### 3.2 Result-SELECT Query

Operations with side effects, such as INSERT, UPDATE, DELETE, and MERGE, are evaluated in ZTD by focusing on the result that would be produced by executing the operation.  
The operation itself is not executed; only the result is reproduced using a SELECT query.  
From the perspective of unit testing, this is sufficient.

Consider an UPDATE statement:

```sql
-- origin
update users
set
  name = 'Alice'
where
  id = $1
returning
  id, name;
```

In ZTD, this is reinterpreted in terms of the final result, and expressed as the following SELECT:

```sql
-- ZTD
with users as (
  select 1::int as id, 'alice'::text as name
  union all
  select 2::int as id, 'bob'::text as name
)
select
  id,
  'Alice' as name -- simulate
from
  users
where
  id = $1;
```

Here, CTE Shadowing reconstructs the current table state, and the effect of the UPDATE is represented as a side-effect-free SELECT.

Write operations without RETURNING can be represented using count queries:

```sql
-- ZTD
with users as (
  ...
)
select
  count(*)
from
  users
where
  id = $1;
```

### 3.3 Query Conversion

Implementing CTE Shadowing and Result-SELECT Query requires advanced query transformation.  
To support this, we developed a custom SQL parser from scratch in Pure TypeScript with zero external dependencies.

This parser makes it possible to treat SQL as an abstract syntax tree (AST) and automate the following kinds of analysis and transformation:

- Detecting CRUD operations
- Detecting tables and columns
- Expanding fixtures and inserting type information
- Injecting CTE Shadowing
- Converting into SELECT statements

Even after these large-scale transformations, the following properties are preserved:

- Semantics
- Placeholders
- Syntactic structure

### 3.4 SQL Interceptor

The SQL Interceptor hooks into SQL issued by the database driver and applies Query Conversion dynamically.  
This enables the following:

- No changes are required to existing SQL
- Both handwritten SQL and ORM-generated SQL work as they are
- No additional DSL is required; existing SQL can be used directly

## 4. What ZTD Does Not Cover

ZTD is a model specialized for unit testing of SQL logic.  
For this reason, the following areas are outside its scope:

- Transaction consistency spanning multiple operations
- ETL flows that require stateful processing
- Physical optimization (locks, indexes, execution plans, and so on)
- Database-dependent features (stored procedures, views, and the like)

## 5. Summary

ZTD is a new model for SQL testing with the following characteristics:

- SQL can be treated like a pure function
- Physical tables are not required
- Zero side effects
- Fast and parallel test execution is easy
- Existing SQL can be used unchanged (both handwritten and ORM-generated)

This makes it possible to validate SQL quickly and deterministically, greatly reducing the uncertainty associated with placing application logic in SQL.
