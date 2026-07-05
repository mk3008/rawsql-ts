---
name: api-output-shape-review
description: Review public and transformer API output shape decisions for SQL/AST/model transformations, ensuring callers can choose model versus string output and customize formatting when string output is produced.
---

# API Output Shape Review

Use this skill when a public API, near-public helper, or transformer API parses, transforms, optimizes, rewrites, injects, renames, composes, decomposes, formats, or analyzes SQL/AST/model data and returns SQL strings, AST/model objects, formatted SQL, or a result object containing `sql`.

Any transformation API whose primary returned artifact is SQL text is a review candidate, even when the current implementation does not chain multiple transforms internally. Callers may compose these APIs outside the library, so SQL-only output can still force reparsing, formatter-dependent output, model-level information loss, and avoidable parse/format performance overhead across user-defined pipelines.

## Review Targets

- Functions that accept SQL and return SQL.
- Functions that accept AST/model objects and return SQL.
- Functions that transform, optimize, format, parse, or analyze SQL/AST/model data.
- Functions that rewrite, inject, rename, compose, decompose, convert, or otherwise modify SQL/AST/model data and return `string`, `formattedSql`, or `result.sql` as the primary transformed artifact.
- APIs exported from `packages/core/src/index.ts`.
- Transformer APIs under `packages/core/src/transformers/**`.
- `Result` interfaces or types that include `sql: string`.
- APIs that call `formatSqlComponent(...)`, `SqlFormatter`, or equivalent formatter helpers to produce result strings.

## 1. Output Shape Choice

Check whether callers can choose the shape they need instead of receiving only a formatted SQL string.

Preferred shapes include:

```ts
type OutputMode = "model" | "sql" | "both";
```

```ts
interface TransformResult {
  query: SelectQuery | null;
  sql?: string;
}
```

```ts
interface TransformOptions {
  output?: "model" | "sql" | "both";
}
```

For existing public APIs, prefer additive compatibility. Do not remove an existing `sql: string` return field just to improve the model shape. Prefer adding `query`, `model`, `ast`, or a mode option while keeping `result.sql` available for existing callers.

## 2. Formatter Customization

When an API produces SQL strings, check whether callers can customize formatting.

Preferred shapes include:

```ts
interface TransformOptions {
  formatter?: (query: SelectQuery) => string;
}
```

```ts
interface TransformOptions {
  formatOptions?: SqlFormatterOptions;
}
```

Use the repository's existing formatter option types when they exist. The goal is not to introduce a parallel formatter system, but to avoid hard-coding one string representation when callers already have format rules.

## 3. Avoid SQL Strings as Intermediate Artifacts

Review transformation pipelines for unnecessary round trips such as:

```text
AST -> SQL -> AST -> SQL
```

This review is not limited to pipelines that are visible inside the repository. A single exported transformation that returns only SQL text can create the same round trip when callers compose it with another transformation:

```ts
const first = transformA(sql).sql;
const second = transformB(first).sql;
const third = transformC(second).sql;
```

When a later phase only needs the transformed query, prefer passing AST/model data forward directly. When callers may reasonably chain the API with other transforms, prefer exposing AST/model output alongside compatibility SQL output so user-defined pipelines do not have to reparse formatter-generated text. Treat unnecessary AST-to-SQL-to-AST round trips as both correctness risk and performance risk.

Review smells include:

- `phase.sql`, `result.sql`, or `formattedSql` passed into another optimizer, transformer, rewriter, composer, or analyzer.
- `const sourceSql = typeof input === "string" ? input : formatSqlComponent(input)` followed by `SelectQueryParser.parse(sourceSql)`.
- An input type such as `string | SelectQuery` or `string | *Query` paired with a result shape whose only transformed artifact is `sql: string`.
- A transformation function returning `string` directly after formatting an AST/model.
- A warning such as `AST_INPUT_FORMATTED` or `formatterGeneratedSource` without an alternate model-first output path.

If compatibility, comment preservation, formatter limitations, source-span requirements, or existing parser constraints require a staged string path, record the reason and the future improvement path in a comment, test, design note, or review report.

## 4. Diff, Debugging, and Downstream Processing

For SQL diff or debugging surfaces, check that formatting differences do not obscure semantic differences.

Review whether:

- Meaningful optimization differences are separated from formatting differences.
- Callers can supply their existing formatting rules when SQL output is requested.
- Semantic changes can be explained through `applied`, `skipped`, `moves`, or similar structured logs instead of only string diffs.
- Lineage tools and other downstream processors can receive AST/model output without reparsing SQL.

## 5. Existing Compatibility

Do not remove existing public `sql` fields without an explicit breaking-change path.

Default compatibility direction:

```text
Existing: result.sql
Add: result.query / result.model / result.ast
Add: options.formatter / options.formatOptions
```

If a breaking change is unavoidable, require a changeset, migration guidance, compatibility API, and documentation updates.

## 6. Test Expectations

When related APIs change, cover the relevant behavior with tests:

- SQL input still exposes `sql` as before.
- AST input does not mutate the original AST unexpectedly.
- `query`, `model`, or `ast` represents the optimized/transformed state.
- `formatter` or `formatOptions` affects `sql` output when supplied.
- A model-only mode avoids unnecessary SQL generation or reparsing.
- A both-output mode keeps AST/model and SQL aligned to the same transformed result.
- Parse failure behavior, such as `query: null`, is explicit.

## Review Note

When a commit touches a likely public SQL/AST transformation API, leave a short review note in the staged diff. The note can live in code, tests, docs, or design material.

Example:

```md
API output shape review: kept result.sql for compatibility and added result.query for downstream AST processing.
```

Avoid adding empty ritual comments. The note should state the actual compatibility and model-vs-string decision.
