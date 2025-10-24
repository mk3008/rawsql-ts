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

`SqlFormatterOptions` extends `BaseFormattingOptions`. The table below lists the core knobs, which values they accept, and what happens when you leave them out. Defaults come straight from the `SqlPrinter` constructor.

| Option | Allowed values | Default when omitted | What it controls |
| --- | --- | --- | --- |
| `indentSize` | Any non‑negative integer | `0` | Number of `indentChar` repetitions per nesting level. Set `indentSize: 4` for four spaces per indent. |
| `indentChar` | `'space'`, `'tab'`, or any literal string (e.g. `'  '` or `'\t'`) | `''` (no indent characters) | The unit inserted for each indent level. Pair with `indentSize` to get consistent spacing. |
| `newline` | `'lf'`, `'crlf'`, `'cr'`, or a literal string such as `'\n'` | `' '` (single space) | Line separator used by the formatter. Set to `'lf'` or `'\n'` for multi-line output; the space default keeps everything on one line. |
| `keywordCase` | `'none'`, `'upper'`, `'lower'` | `'none'` | Forces SQL keywords to a particular case without touching identifiers. |
| `commaBreak` | `'none'`, `'before'`, `'after'` | `'none'` | Global comma placement for SELECT lists, INSERT columns, etc. |
| `cteCommaBreak` | Same as `commaBreak` | Mirrors `commaBreak` | Specialised comma placement inside `WITH` definitions. |
| `valuesCommaBreak` | Same as `commaBreak` | Mirrors `commaBreak` | Comma handling within `VALUES` tuples. |
| `andBreak` | `'none'`, `'before'`, `'after'` | `'none'` | Controls whether logical `AND` operators move to their own lines. |
| `orBreak` | `'none'`, `'before'`, `'after'` | `'none'` | Same idea for logical `OR` operators. |
| `indentNestedParentheses` | `true` / `false` | `false` | Adds an extra indent when boolean groups introduce parentheses inside `WHERE` or `HAVING` clauses. |
| `commentStyle` | `'block'`, `'smart'` | `'block'` | Normalises how comments are emitted (see below). |
| `withClauseStyle` | `'standard'`, `'cte-oneline'`, `'full-oneline'` | `'standard'` | Expands or collapses common table expressions. |
| `parenthesesOneLine`, `betweenOneLine`, `valuesOneLine`, `joinOneLine`, `caseOneLine`, `subqueryOneLine` | `true` / `false` | `false` for each | Opt-in switches that keep the corresponding construct on a single line even if other break settings would expand it. |
| `exportComment` | `true` / `false` | `false` | Emits comments collected by the parser. Turn it on when you want annotations preserved. |
| `castStyle` | 'standard', 'postgres' | From preset or 'standard' | Chooses how CAST expressions are printed. 'standard' emits ANSI `CAST(expr AS type)` while 'postgres' emits `expr::type`. See "Controlling CAST style" below for usage notes and examples. |

Combine these settings to mirror house formatting conventions or align with existing lint rules. The following sections call out the options that trip up newcomers most often.

### Indentation and newlines

- **Indentation:** Set both `indentChar` and `indentSize`. A common four-space indent looks like:
  ```json
  { "indentChar": "space", "indentSize": 4 }
  ```
- **Multi-line output:** Because the default `newline` is a single space, remember to switch it to `'lf'` (or another newline) when you want each clause on its own line:
  ```json
  { "newline": "lf" }
  ```
  This pairs nicely with `indentSize` to produce classic, vertical SQL layouts.

### Comma break styles

| Value | Layout effect |
| --- | --- |
| `'none'` | Leaves commas inline: `SELECT a, b, c`. |
| `'after'` | Writes each item on its own line and keeps the comma at the end of the line (trailing-comma style). |
| `'before'` | Moves the comma to the next line so each row starts with `, column_name`. |

Set `commaBreak` for the general case, then override `cteCommaBreak` or `valuesCommaBreak` when you need different list behaviour in `WITH` or `VALUES` clauses. Example: trailing commas in SELECT lists but inline tuples inside `VALUES`.

```typescript
const formatter = new SqlFormatter({
    newline: 'lf',
    commaBreak: 'after',          // SELECT list uses trailing commas
    valuesCommaBreak: 'none'      // VALUES tuples stay compact
});
```

### Keyword break options (`andBreak`, `orBreak`)

- `'before'` produces styles like `AND condition` with the logical keyword leading the line.
- `'after'` keeps the keyword on the same line as the previous expression and breaks right after it.
- `'none'` leaves the logical operators inline.

Choose `'before'` when you want to scan down logical branches quickly, or `'after'` to keep complex conditions aligned underneath their keywords.

### Comment style tips

Set `commentStyle: 'smart'` when you want single-line annotations to become SQL line comments (`-- like this`) while multi-line explanations are preserved as block comments. Separator banners such as `/* ===== */` stay grouped, and consecutive block comments continue to merge into a readable multi-line block.

Default behaviour (`'block'`) leaves comments exactly as they were parsed. Switch to `'smart'` whenever inline `/* like this */` notes should turn into proper `--` line comments while still keeping multi-line doc blocks intact.

### VALUES clause formatting tips

Use `valuesCommaBreak` when you need to keep the main query in trailing-comma style but prefer inline tuples inside a `VALUES` block (or vice versa). With `exportComment: true`, comments that appear before or after each tuple are preserved and printed alongside the formatted output, so inline annotations survive automated formatting.


### Controlling CAST style

`castStyle` lets you toggle between ANSI-compatible casts and PostgreSQL's shorthand.

```typescript
new SqlFormatter().format(expr);                 // cast("price" as NUMERIC(10, 2))
new SqlFormatter({ castStyle: 'postgres' }).format(expr); // "price"::NUMERIC(10, 2)
```

- Default (`'standard'`) keeps ANSI `CAST(... AS ...)`, which works across engines such as MySQL, SQL Server, DuckDB, and more.
- Set `castStyle: 'postgres'` when you explicitly target PostgreSQL-style `::` casts. Presets like `'postgres'`, `'redshift'`, and `'cockroachdb'` already switch this on.

If you are migrating away from PostgreSQL-only syntax, enforce `castStyle: 'standard'` and phase out `::` usage gradually.
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
  "orBreak": "before",
  "indentNestedParentheses": true,
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

### Nested parentheses indentation

Set `indentNestedParentheses: true` to expand only the outermost boolean groups while keeping innermost comparisons in a single line. This is useful for `WHERE` clauses that mix grouping parentheses with longer `OR` chains: the first nesting level is indented for readability, while the deepest `(a <= x and x <= b)` style checks stay on one line. Pair it with `orBreak: 'before'` or `'after'` when you want every `OR` branch to fall on its own line.

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
