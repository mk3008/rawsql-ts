---
"@rawsql-ts/ztd-cli": patch
---

Improve `ztd query uses` stability by keeping usage-kind summaries deterministic, bounding statement-location cache growth, and isolating spec-load failures so one bad spec file does not abort the full report.
