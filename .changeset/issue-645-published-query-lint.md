---
'@rawsql-ts/ztd-cli': patch
---

Add a published-package verification gate that checks `ztd query lint --help` still exposes `--rules` and that `ztd query lint --rules join-direction <sql-file>` runs on the packed CLI path. This keeps the release contract aligned with the Further Reading docs for the join-direction lint command surface.
