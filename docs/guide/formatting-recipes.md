---
title: Formatting Recipes
outline: deep
---

# SqlFormatter Recipes

## Quick Start

`SqlFormatter` turns parsed or dynamically generated queries into legible SQL. Instantiate it with `SqlFormatterOptions`, call `format`, and receive both the printable SQL text and normalized parameters.

```typescript
import { SqlFormatter } from 'rawsql-ts';

const formatter = new SqlFormatter({ keywordCase: 'upper', indentSize: 4 });
const { formattedSql, params } = formatter.format(query);
```

## Base Formatting Options

`SqlFormatterOptions` extends `BaseFormattingOptions`. The following knobs cover the most common layout needs:

| Option | Purpose |
| --- | --- |
| `indentSize` + `indentChar` | Control indentation width. Use logical names like `space`/`tab` or provide literal characters. |
| `newline` | Switch between logical names `lf`, `crlf`, `cr` or provide literal newline strings. |
| `keywordCase` | Force keywords to upper or lower case while leaving identifiers untouched. |
| `commaBreak` / `cteCommaBreak` | Choose between inline commas and vertical lists for general clauses or `WITH` definitions. |
| `valuesCommaBreak` | Override comma placement specifically inside `VALUES` tuples without changing the global comma setting. |
| `andBreak` | Balance boolean logic readability by breaking `AND`/`OR` groups. |
| `commentStyle` | Convert comments to a normalized style while preserving placement. |
| `withClauseStyle` | Collapse or fan out common table expressions. |
| `parenthesesOneLine`, `joinOneLine`, etc. | Keep tight expressions compact when vertical whitespace would hurt readability. |

Combine these options to mirror house formatting conventions or align with existing lint rules.

### VALUES clause formatting tips

Use `valuesCommaBreak` when you need to keep the main query in trailing-comma style but prefer inline tuples inside a `VALUES` block (or vice versa). With `exportComment: true`, comments that appear before or after each tuple are preserved and printed alongside the formatted output, so inline annotations survive automated formatting.

## Sample

```json
{
  "identifierEscape": "none",
  "parameterSymbol": ":",
  "parameterStyle": "named",
  "indentSize": 4,
  "indentChar": "space",
  "newline": "lf",
  "keywordCase": "lower",
  "commaBreak": "before",
  "cteCommaBreak": "after",
  "valuesCommaBreak": "after",
  "andBreak": "before",
  "exportComment": true,
  "commentStyle": "smart",
  "parenthesesOneLine": true,
  "betweenOneLine": true,
  "valuesOneLine": true,
  "joinOneLine": true,
  "caseOneLine": true,
  "subqueryOneLine": true
}
```

## Parameter Style Deep Dive

`parameterStyle` determines how placeholders are printed and how `params` is shaped when you call `format`:

### Named parameters

```typescript
const formatter = new SqlFormatter({ parameterStyle: 'named', parameterSymbol: ':' });
const { formattedSql, params } = formatter.format(query);

// params => { userId: 42, status: 'active' }
```

Use this when your driver accepts named bindings (e.g. `:userId`). `params` is a dictionary keyed by the placeholder names injected by `DynamicQueryBuilder` or your custom query graph.

### Indexed parameters

```typescript
const formatter = new SqlFormatter({ parameterStyle: 'indexed', parameterSymbol: '$' });
const { formattedSql, params } = formatter.format(query);

// params => ['active', 42]
```

Indexed mode emits placeholders like `$1`, `$2`, `$3`, preserving array order. Choose it for PostgreSQL adapters or any engine that matches ordered binds.

### Anonymous parameters

```typescript
const formatter = new SqlFormatter({ parameterStyle: 'anonymous', parameterSymbol: '?' });
const { formattedSql, params } = formatter.format(query);

// params => ['active', 42]
```

Anonymous style prints bare symbols such as `?` or `%s`. `SqlFormatter` still returns an array so you can hand it to clients that expect positional parameters.

> Tip: You can mix `parameterStyle` with presets like `{ preset: 'postgres' }`. Presets provide sensible defaults that you can override per option when integrating with legacy code.

## Learn More

Check the full [`SqlFormatterOptions` API](../api/interfaces/SqlFormatterOptions.md) documentation for every toggle, including advanced preset configuration and default values.
