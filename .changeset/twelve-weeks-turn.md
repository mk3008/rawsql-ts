---
"rawsql-ts": minor
---

Fixed incorrect tokenization of Postgres-style positional parameters (`$1, $2`).

The SQL Server MONEY literal detector mistakenly treated the comma after `$1` as part of a numeric literal.
MONEY detection is now limited to cases where `,` or `.` is followed by a digit, allowing `$1, $2` to be tokenized correctly as parameter + comma + parameter.

Added regression tests for positional parameters in the parser and token readers.
