---
'@rawsql-ts/test-evidence-renderer-md': patch
'@rawsql-ts/ztd-cli': patch
---

Fix markdown definition/file links to be resolved relative to each markdown output location in local path mode.

When GitHub Actions metadata is not present, renderer links now compute relative paths from the markdown directory to the source definition path, preventing broken links in generated artifacts.
