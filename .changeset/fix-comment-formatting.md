---
"rawsql-ts": patch
---

Fix SQL formatter comment handling for comma-prefixed expressions, LIMIT/OFFSET values, function arguments, and parenthesized predicates. Comments are no longer duplicated around function arguments, ORDER BY/GROUP BY items, and parenthesized WHERE predicates, comments after HAVING/JOIN ON/LIMIT/OFFSET keywords are preserved, commented function arguments expand to a readable multiline layout, comments after AND/OR operators indent the following predicate, and comments after list commas now use readable before-comma and after-comma layouts for SELECT, ORDER BY, and GROUP BY items.
