---
"rawsql-ts": minor
---

Add the `oneLineMaxLength` formatter option. When enabled, opt-in one-line constructs such as parentheses, CASE expressions, JOIN conditions, subqueries, and `cte-oneline` CTE entries stay compact only while their rendered candidate fits within the configured width; longer candidates fall back to the normal multiline formatter.

Also add JOIN condition layout controls: `joinOnBreak: "before"` can place `ON` on its own indented line, and `joinConditionContinuationIndent` can indent wrapped `AND` / `OR` predicates inside `JOIN ... ON` conditions.
