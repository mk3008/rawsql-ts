# ZTD rewrite microbenchmark

## Scope
- Measures the pure rewrite pipeline (parse + AST conversion + SQL formatting) without any database interaction.
- Runs against the same customer summary SQL in both a small and a large variant to spotlight AST size effects.
- Warmup: 2 iterations; measured iterations per variant: 8.
- Each measured iteration repeats the rewrite stages 1000 times and reports per-call averages (total / 1000) to reduce timer noise.

## Stage definitions
- `parse`: `SqlParser.parse` consumes the SQL string into a `ParsedStatement`.
- `ztd_convert`: `ResultSelectRewriter.convertStatement` plus schema-alias rewriting on the parsed AST.
- `stringify`: `SqlFormatter.format` renders the rewritten AST back into text.

## Measurements

| Variant | Stage | Mean (ms/call) | StdDev (ms) | StdErr (ms) |
| --- | --- | --- | --- | --- |
| small | parse | 0.12 | 0.01 | 0.00 |
| small | ztd_convert | 0.00 | 0.00 | 0.00 |
| small | stringify | 0.00 | 0.00 | 0.00 |
| large | parse | 0.22 | 0.01 | 0.00 |
| large | ztd_convert | 0.00 | 0.00 | 0.00 |
| large | stringify | 0.00 | 0.00 | 0.00 |

## Notes
- The microbenchmark reports mean / standard deviation / standard error per stage after discarding warmup iterations.
- Each iteration aggregates 1000 rewrites so that the reported mean is the per-call average (total / 1000) and timer noise is reduced.
- Higher values in `ztd_convert` suggest the AST rewrite work is the primary tuning candidate; compare small vs large to see the sensitivity to SQL size.
- Raw stage logs: tmp\ztd-rewrite-microbench.jsonl

## Next focus
- small: parse dominates (mean 0.12 ms).
- large: parse dominates (mean 0.22 ms).