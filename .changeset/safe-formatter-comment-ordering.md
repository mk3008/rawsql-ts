---
"rawsql-ts": patch
---

Improve SQL formatter safety for comments, explicit ordering, and optional keyword controls. Smart comments now fall back to block comments when one-line formatting cannot preserve a safe line break, commented CTEs no longer lose comments in `cte-oneline` mode, top-level header comments remain on separate lines before `WITH`, and `orderByDefaultDirectionStyle: "explicit"` now adds `ASC` to `ORDER BY` items that omit a direction. `sourceAliasStyle` now accepts the aligned values `"omit"` and `"explicit"` while preserving compatibility with the legacy `"implicit"` and `"as"` values. Demo style JSON now normalizes legacy `exportComment: true` / `false` to `"full"` / `"none"`, `keywordCase: "preserve"` to `"none"`, and `joinOnBreak: "after"` to `"none"` so existing saved styles continue to load while the GUI presents canonical choices.
