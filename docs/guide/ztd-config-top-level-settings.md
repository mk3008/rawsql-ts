# ztd.config.json Top-Level Settings

`ztd.config.json` keeps schema resolution at the top level:

```json
{
  "dialect": "postgres",
  "ztdRootDir": ".ztd",
  "ddlDir": "db/ddl",
  "testsDir": ".ztd/tests",
  "defaultSchema": "public",
  "searchPath": ["public"],
  "ddlLint": "strict"
}
```

`ddl.defaultSchema` and `ddl.searchPath` are no longer read.

Use this reference when you want to confirm where the generated config keeps schema resolution and which fields are still honored by `ztd-cli`.
