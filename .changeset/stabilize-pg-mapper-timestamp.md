---
"@rawsql-ts/mapper": patch
---
Stabilize the pg mapper timestamp test by comparing local Date values via getTime so it no longer depends on the host time zone.
