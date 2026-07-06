---
"rawsql-ts": minor
---

Add `skipDisposition` metadata to condition optimization skipped items so callers can distinguish blocked, unchanged, and ignored skips without parsing reason strings.

SSSQL optional branch refresh now avoids treating duplicate parameters across UNION branches as a global refresh failure, keeping duplicate local branches unchanged while allowing unrelated branches to be classified independently.

API output shape review: kept `result.sql` and the existing `applied`/`skipped`/`warnings`/`errors` result shape for compatibility, and added structured skipped-item metadata for downstream processing.
