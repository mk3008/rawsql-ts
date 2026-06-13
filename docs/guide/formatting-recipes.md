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
| `newline` | `'space'`, `'lf'`, `'crlf'`, `'cr'`, or a literal string such as `'\n'` | `' '` (single space) | Line separator used by the formatter. Set to `'lf'` or `'\n'` for multi-line output; use `'space'` for one-line output. |
| `keywordCase` | `'none'`, `'upper'`, `'lower'` (legacy `'preserve'` still accepted as `'none'`) | `'none'` | Forces SQL keywords to a particular case without touching identifiers. |
| `commaBreak` | `'none'`, `'before'`, `'after'` | `'none'` | Global comma placement for SELECT lists, INSERT columns, etc. |
| `cteCommaBreak` | Same as `commaBreak` | Mirrors `commaBreak` | Specialised comma placement inside `WITH` definitions. |
| `valuesCommaBreak` | Same as `commaBreak` | Mirrors `commaBreak` | Comma handling within `VALUES` tuples. |
| `andBreak` | `'none'`, `'before'`, `'after'` | `'none'` | Controls whether logical `AND` operators move to their own lines. |
| `orBreak` | `'none'`, `'before'`, `'after'` | `'none'` | Same idea for logical `OR` operators. |
| `joinOnBreak` | `'none'`, `'before'` (legacy `'after'` still accepted as `'none'`) | `'none'` | Controls whether `JOIN ... ON` keeps `ON` inline or starts it on an indented continuation line. |
| `joinConditionContinuationIndent` | `true` / `false` | `false` | Indents wrapped `AND` / `OR` predicates inside `JOIN ... ON` conditions so they read as join-condition continuations instead of sibling joins. |
| `insertColumnsOneLine` | `true` / `false` | `false` | Keeps column lists inside `INSERT INTO` statements on a single line when `true`. |
| `indentNestedParentheses` | `true` / `false` | `false` | Adds an extra indent when boolean groups introduce parentheses inside `WHERE` or `HAVING` clauses. |
| `commentStyle` | `'block'`, `'smart'` | `'block'` | Normalises how comments are emitted (see below). |
| `withClauseStyle` | `'standard'`, `'cte-oneline'`, `'full-oneline'` | `'standard'` | Expands or collapses common table expressions. |
| `parenthesesOneLine`, `betweenOneLine`, `inOneLine`, `valuesOneLine`, `joinOneLine`, `caseOneLine`, `subqueryOneLine` | `true` / `false` | `false` for each | Opt-in switches that keep the corresponding construct on a single line even if other break settings would expand it. |
| `oneLineMaxLength` | Positive integer, `0`, `null`, or omitted | Unlimited | Optional width guard for opt-in one-line constructs. `0`, `null`, or omitting the option disables the guard. When a one-line candidate would exceed a positive limit, the formatter falls back to the normal multiline layout for that construct. |
| `joinConditionOrderByDeclaration` | `true` / `false` | `false` | Normalizes `JOIN ... ON` column comparisons so the left operand matches table declaration order. |
| `whenOneLine` | `true` / `false` | `false` | Forces each `MERGE WHEN` predicate to stay on a single line even if `andBreak` / `orBreak` would normally wrap it. |
| `exportComment` | `'full'`, `'none'`, `'header-only'`, `'top-header-only'` (legacy `true` / `false` still accepted) | `'none'` | Controls which comments are emitted: `'full'` prints everything, `'none'` drops all comments, `'header-only'` keeps leading comments on every block, and `'top-header-only'` keeps only top-level headers. |
| `identifierEscape` | `'none'`, `'quote'`, `'backtick'`, `'bracket'`, or `{ "start": string, "end": string }` | From preset or `'quote'` internally | Chooses the identifier delimiter symbol. `'none'` means no delimiter symbol, not "no identifiers targeted". |
| `identifierEscapeTarget` | `'all'`, `'minimal'` | `'all'` | Chooses whether the formatter escapes every identifier or only identifiers that need escaping to stay valid and semantically safe. Pair it with `identifierEscape`, e.g. `{ "identifierEscape": "quote", "identifierEscapeTarget": "minimal" }`. |
| `sourceAliasStyle` | `'explicit'`, `'omit'` (legacy `'as'` / `'implicit'` still accepted) | From preset or `'explicit'` | Controls whether source aliases render as `from users as u` or `from users u`. |
| `columnAliasStyle` | `'explicit'`, `'omit'` (legacy `'as'` / `'implicit'` still accepted) | `'explicit'` | Controls whether select-list column aliases render as `select id as user_id` or `select id user_id`. |
| `orderByDefaultDirectionStyle` | `'omit'`, `'explicit'` | From preset or `'omit'` | Controls whether default ascending sort direction is omitted or printed as `ASC`. |
| `castStyle` | 'standard', 'postgres' | From preset or 'standard' | Chooses how CAST expressions are printed. 'standard' emits ANSI `CAST(expr AS type)` while 'postgres' emits `expr::type`. See "Controlling CAST style" below for usage notes and examples. |
| `constraintStyle` | `'postgres'`, `'mysql'` | From preset or `'postgres'` | Shapes constraint output in DDL: `'postgres'` prints `constraint ... primary key(...)`, while `'mysql'` emits `unique key name(...)` / `foreign key name(...)`. |

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

### JOIN condition layouts

JOIN predicates can become hard to scan when a long `ON` condition wraps and the continuation `AND` / `OR` lines align with the JOIN itself:

```sql
left join last_customer_reply lcr on lcr.ticket_id = st.ticket_id
and lcr.tenant_id = st.tenant_id
```

Use `joinConditionContinuationIndent: true` when you want to keep the first `ON` predicate inline but indent continuation predicates:

```typescript
const formatter = new SqlFormatter({
    newline: 'lf',
    andBreak: 'before',
    joinConditionContinuationIndent: true
});
```

```sql
left join last_customer_reply lcr on lcr.ticket_id = st.ticket_id
    and lcr.tenant_id = st.tenant_id
    and lcr.source_id = st.source_id
```

Use `joinOnBreak: 'before'` when your style separates the JOIN target from the condition itself:

```typescript
const formatter = new SqlFormatter({
    newline: 'lf',
    andBreak: 'before',
    joinOnBreak: 'before'
});
```

```sql
left join last_customer_reply lcr
    on lcr.ticket_id = st.ticket_id
    and lcr.tenant_id = st.tenant_id
    and lcr.source_id = st.source_id
```

The JOIN-specific options only change predicates inside `JOIN ... ON`. `WHERE`, `HAVING`, and other boolean expressions continue to follow `andBreak` / `orBreak` directly.

### MERGE `WHEN` predicate layout

`MERGE` statements reuse the same `andBreak` / `orBreak` logic as `WHERE` clauses, so enabling `'before'` or `'after'` normally splits predicates such as `WHEN MATCHED AND target.flag = 'Y'` across multiple lines. Set `whenOneLine: true` to keep each `WHEN` predicate compact while still honouring your preferred breaks elsewhere:

```typescript
const formatter = new SqlFormatter({
    newline: 'lf',
    andBreak: 'before',
    whenOneLine: true
});
// when matched and target.flag = 'Y'
//     then update set status = source.status
```

The switch leaves other logical groups untouched, so `WHERE` clauses continue to follow the global `andBreak` / `orBreak` style.

### Keeping short one-line groups without flattening long predicates

The `*OneLine` switches are useful for compact predicates such as SSSQL optional filters:

```sql
(cast(:status as text) is null or status = :status)
```

The same switch can become hard to read when the predicate grows into a long keyword search or a `CASE` expression. Set `oneLineMaxLength` to keep short candidates compact while allowing long candidates to fall back to the regular multiline formatter:

```typescript
const formatter = new SqlFormatter({
    newline: 'lf',
    parenthesesOneLine: true,
    caseOneLine: true,
    orBreak: 'before',
    oneLineMaxLength: 100
});
```

With the width guard enabled, a short optional predicate can stay on one line, while a longer group expands into the configured logical-operator layout:

```sql
(
    :keyword is null
    or subject ilike '%' || :keyword || '%'
    or customer_name ilike '%' || :keyword || '%'
    or latest_message_body ilike '%' || :keyword || '%'
)
```

The limit applies to opt-in one-line containers such as parentheses, `BETWEEN`, `IN` value lists, `VALUES`, `JOIN ... ON`, `CASE`, subqueries, and individual CTE entries formatted by `withClauseStyle: 'cte-oneline'`. The width check includes the current indentation and any text already present on the line. It does not change `withClauseStyle: 'full-oneline'`, which intentionally treats the whole `WITH` block as a single-line mode.

### INSERT column list layouts

`insertColumnsOneLine` gives you a dedicated switch for shaping `INSERT INTO` column lists without disturbing the rest of your comma settings.

- `false` (default) expands each column when you combine it with `commaBreak: 'before'` or `'after'`:
  ```typescript
  const formatter = new SqlFormatter({
      newline: 'lf',
      commaBreak: 'before'
  });
  // insert into table_a(
  //     id
  //     , value
  // )
  // values ...
  ```
- `true` keeps the table name and columns on one line, while `valuesCommaBreak` continues to control the `VALUES` tuples:
  ```typescript
  const formatter = new SqlFormatter({
      newline: 'lf',
      insertColumnsOneLine: true
  });
  // insert into table_a(id, value)
  // values ...
  ```

The two insert layouts make it easy to adopt either a compact DML style or a vertically aligned style without rewriting other recipes.

### Comment style tips

Set `commentStyle: 'smart'` when you want single-line annotations to become SQL line comments (`-- like this`) while multi-line explanations are preserved as block comments. Separator banners such as `/* ===== */` stay grouped, and consecutive block comments continue to merge into a readable multi-line block.

Default behaviour (`'block'`) leaves comments exactly as they were parsed. Switch to `'smart'` whenever inline `/* like this */` notes should turn into proper `--` line comments while still keeping multi-line doc blocks intact.

### VALUES clause formatting tips

Use `valuesCommaBreak` when you need to keep the main query in trailing-comma style but prefer inline tuples inside a `VALUES` block (or vice versa). With `exportComment: 'full'`, comments that appear before or after each tuple are preserved and printed alongside the formatted output, so inline annotations survive automated formatting. Prefer `'header-only'` or `'top-header-only'` when you only want to keep leading annotations instead of every inline remark.


### Controlling CAST style

`castStyle` lets you toggle between ANSI-compatible casts and PostgreSQL's shorthand.

```typescript
new SqlFormatter().format(expr);                 // cast("price" as NUMERIC(10, 2))
new SqlFormatter({ castStyle: 'postgres' }).format(expr); // "price"::NUMERIC(10, 2)
```

- Default (`'standard'`) keeps ANSI `CAST(... AS ...)`, which works across engines such as MySQL, SQL Server, DuckDB, and more.
- Set `castStyle: 'postgres'` when you explicitly target PostgreSQL-style `::` casts. Presets like `'postgres'`, `'redshift'`, and `'cockroachdb'` already switch this on.

If you are migrating away from PostgreSQL-only syntax, enforce `castStyle: 'standard'` and phase out `::` usage gradually.

### Minimal identifier escaping and alias style

`identifierEscape` selects the delimiter symbol, while `identifierEscapeTarget` selects how many identifiers receive that symbol. They are independent settings:

```json
{
  "identifierEscape": "quote",
  "identifierEscapeTarget": "minimal"
}
```

With `minimal`, quoted output is kept only where removing the delimiter would break SQL or change semantics, such as names with spaces, mixed-case identifiers, reserved words, or PostgreSQL special names. Safe lower-case identifiers can print without quotes.

Use `sourceAliasStyle` when you want to omit the optional `AS` keyword for source aliases:

```json
{
  "sourceAliasStyle": "omit"
}
```

This renders `from users u` instead of `from users as u`. Set it to `'explicit'` when your house style prefers explicit aliases.

Use `columnAliasStyle` separately when you want the same control for select-list aliases:

```json
{
  "columnAliasStyle": "omit"
}
```

This renders `select id user_id` instead of `select id as user_id`.

### DDL constraint style

`constraintStyle` controls how table- and column-level constraints appear when formatting `CREATE TABLE` statements.

- `'postgres'` (default) prints explicit `constraint` clauses, e.g.:
  ```sql
  , constraint orders_pkey primary key(order_id)
  , constraint orders_customer_fkey foreign key(customer_id) references customers(customer_id)
  ```
- `'mysql'` drops the leading keyword and mirrors MySQL's `UNIQUE KEY` / inline constraint syntax:
  ```sql
  , unique key orders_customer_unique(customer_id)
  , foreign key orders_customer_fkey(customer_id) references customers(customer_id)
  ```

Pair this option with your target engine: presets such as `'mysql'` enable it automatically, while PostgreSQL-oriented presets keep the default.
## Sample

```json
{
  "identifierEscape": "none",
  "identifierEscapeTarget": "all",
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
  "joinOnBreak": "none",
  "joinConditionContinuationIndent": false,
  "withClauseStyle": "cte-oneline",
  "insertColumnsOneLine": true,
  "oneLineMaxLength": 100,
  "indentNestedParentheses": true,
  "exportComment": "full",
  "commentStyle": "smart",
  "parenthesesOneLine": true,
  "betweenOneLine": true,
  "inOneLine": true,
  "valuesOneLine": true,
  "joinOneLine": true,
  "caseOneLine": true,
  "subqueryOneLine": true,
  "sourceAliasStyle": "omit",
  "columnAliasStyle": "omit",
  "orderByDefaultDirectionStyle": "omit",
  "castStyle": "postgres",
  "constraintStyle": "postgres"
}
```

### Align JOIN conditions with declaration order

Enable `joinConditionOrderByDeclaration` when you want every equality inside a `JOIN ... ON` clause to follow the table declaration order. This keeps the left-hand column aligned with the first table mentioned in the `FROM` clause, which makes symmetrical joins easier to scan.

```json
{
  "joinConditionOrderByDeclaration": true
}
```

Input:

```sql
select *
from account a
inner join invoice i on i.account_id = a.id
```

Output:

```sql
select
  *
from
  "account" as "a"
  inner join "invoice" as "i" on "a"."id" = "i"."account_id"
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

## Formatting DDL statements

`SqlFormatter` now understands schema-definition statements. You can parse `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE` constraint changes, and index management statements and feed the resulting ASTs through the formatter to keep them consistent with query output.

```ts
import {
  CreateTableParser,
  DropTableParser,
  CreateIndexParser,
  DropIndexParser,
  DropConstraintParser,
  AlterTableParser,
  SqlFormatter
} from 'rawsql-ts';

const ddl = `CREATE TABLE IF NOT EXISTS public.users (
  id BIGINT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role_id INT REFERENCES auth.roles(id)
) WITH (fillfactor = 80)`;

const ast = CreateTableParser.parse(ddl);
const { formattedSql } = new SqlFormatter({ keywordCase: 'lower' }).format(ast);
// formattedSql => drop-in-ready canonical SQL
```

Use the dedicated parsers when working with other DDL statements:

- `DropTableParser` for `DROP TABLE` with multi-table targets and cascading options.
- `AlterTableParser` to capture `ADD CONSTRAINT`/`DROP CONSTRAINT` actions on existing tables.
- `CreateIndexParser` and `DropIndexParser` to normalize index definitions, including INCLUDE lists, storage parameters, and partial index predicates.
- `DropConstraintParser` when databases support standalone constraint removal.

These parsers emit strongly typed models (`CreateTableQuery`, `CreateIndexStatement`, `AlterTableStatement`, and more) so the formatter and other visitors can treat DDL alongside queries.
