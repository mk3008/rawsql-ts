# DataAccessLayer 1.0 over ORM

*SQL / AST--first data access architecture*

## 0. Purpose

This document defines the core concepts and constraints of
**DataAccessLayer 1.0**, a SQL/AST-first data access architecture that
**sits above existing ORMs** (or bare drivers) and makes them *testable,
AI-friendly, and DB-agnostic*.

When you (AI agent) generate code or tools for this project, you must
align with these ideas.

## 1. Core Principles

1.  **SQL/AST first, not ORM first**
2.  **DTO = SELECT**
3.  **CUD = SELECT-derivable**
4.  **DB-independent tests first, DB tests later**
5.  **Schema = snapshot, not central truth**
6.  **Migrations = AST diff → DDL, execution is manual**
7.  **No schema type abstraction**
8.  **Transformation is explicit, limited, and predictable**

## 2. Architectural Roles

### 2.1 Repository layer

### 2.2 Schema definition layer

### 2.3 DB adapter & testkit adapter

## 3. Testing Model

-   Repository tests
-   Integration / E2E tests
-   No automatic sync with production DB

## 4. AI Agent Expectations

-   Prefer SQL
-   CUD as SELECT
-   No migration engine
-   Use real DB types
-   Keep transforms small
-   Push policy into SELECT

## 5. Non-Goals

-   Not replacing ORMs fully
-   Not abstracting DB types
-   Not auto-applying migrations
-   Not hiding SQL

## 6. Interoperability

-   Works over any ORM that emits SQL
