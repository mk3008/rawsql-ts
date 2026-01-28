# rawsql-ts

## 0.16.0

### Minor Changes

- [#400](https://github.com/mk3008/rawsql-ts/pull/400) [`1ad78c5`](https://github.com/mk3008/rawsql-ts/commit/1ad78c5430b2ac24e0fb8fe6fb6ecf913e9b9e54) Thanks [@mk3008](https://github.com/mk3008)! - Add includeColumns/excludeColumns to DynamicQueryBuilder, expand tests, and document how to control the final projection.

### Patch Changes

- [`857a3c3`](https://github.com/mk3008/rawsql-ts/commit/857a3c3f21e32610024aa51f636841f9ff9e4ce4) Thanks [@mk3008](https://github.com/mk3008)! - Allow the CreateTable parser to accept `CREATE TEMP TABLE` as a synonym for `CREATE TEMPORARY TABLE` and to retain `ON COMMIT {PRESERVE ROWS | DELETE ROWS | DROP}` options when handling PostgreSQL-style statements.

- [#411](https://github.com/mk3008/rawsql-ts/pull/411) [`84ec3a0`](https://github.com/mk3008/rawsql-ts/commit/84ec3a0c5f3e16463c1eee532fc9570bf1bcff93) Thanks [@mk3008](https://github.com/mk3008)! - Document that the CLI templates treat ztd/ddl as the only authoritative source, keep optional references purely informational, and ship the mapper/writer sample with its supporting tests.

- [#416](https://github.com/mk3008/rawsql-ts/pull/416) [`2361f3c`](https://github.com/mk3008/rawsql-ts/commit/2361f3cbdf7589984bbbe7779ffb5d8129ff3804) Thanks [@mk3008](https://github.com/mk3008)! - Pin lodash consumers to 4.17.23 to resolve GHSA-xxjr-mmjv-4gpg.

- [#402](https://github.com/mk3008/rawsql-ts/pull/402) [`fc7a80e`](https://github.com/mk3008/rawsql-ts/commit/fc7a80e237850dc3c5f06dd7c8ad5472af1e3dc8) Thanks [@mk3008](https://github.com/mk3008)! - Ensure serial/serial8 pseudo-types are normalized before casts and that columns without explicit defaults get a deterministic `row_number() over ()` expression so RETURNING clauses work when the column is omitted.

- [#417](https://github.com/mk3008/rawsql-ts/pull/417) [`f957e21`](https://github.com/mk3008/rawsql-ts/commit/f957e219ab5f1f27df2bc771fc25032ccf35f226) Thanks [@mk3008](https://github.com/mk3008)! - Handle Postgres table functions (e.g. unnest) that declare WITH ORDINALITY when appearing in FROM sources so the parser, AST, formatter, and docs all expose the flag.

## 0.15.1

### Patch Changes

- Pin lodash consumers to 4.17.23 to resolve GHSA-xxjr-mmjv-4gpg.

## 0.15.0

### Patch Changes

- [#393](https://github.com/mk3008/rawsql-ts/pull/393) [`ee41f6d`](https://github.com/mk3008/rawsql-ts/commit/ee41f6d270c8174f0c6128ece3f3abd55a726f3d) Thanks [@mk3008](https://github.com/mk3008)! - Document the DynamicQueryBuilder pruning options and stabilize the accompanying optimizer tests with formatter-agnostic assertions.

- [#390](https://github.com/mk3008/rawsql-ts/pull/390) [`45c55bd`](https://github.com/mk3008/rawsql-ts/commit/45c55bd58f0e1b969ce7bcc6cc35d53d2248ebdd) Thanks [@mk3008](https://github.com/mk3008)! - - Hardened the DynamicQueryBuilder test suite by matching specific named parameters, ORDER BY direction, and EXISTS/NOT EXISTS clause structures so the assertions remain stable regardless of formatter or error-message changes.

- [#385](https://github.com/mk3008/rawsql-ts/pull/385) [`efc6e3f`](https://github.com/mk3008/rawsql-ts/commit/efc6e3fd2c1a9dec3bc54ed446101ed53191fea3) Thanks [@mk3008](https://github.com/mk3008)! - ### Normalize ZTD fixture casts
  - Fixture casts now translate Postgres serial pseudo-types (serial, bigserial, smallserial, etc.) into their real integer targets, so generated SQL never attempts to cast into invalid pseudo-types.

## 0.14.4

## 0.14.3

### Patch Changes

- [#377](https://github.com/mk3008/rawsql-ts/pull/377) [`1cfcc2a`](https://github.com/mk3008/rawsql-ts/commit/1cfcc2ab7502b9f01f4ba53d8e8540b8ca40e3d7) Thanks [@mk3008](https://github.com/mk3008)! - Fix fixture rewriting for self-joins by handling repeated table sources.

## 0.14.2

## 0.14.1

## 0.14.0

### Minor Changes

- [#348](https://github.com/mk3008/rawsql-ts/pull/348) [`963a1d1`](https://github.com/mk3008/rawsql-ts/commit/963a1d141612b981a344858fe9b1a2888a28f049) Thanks [@mk3008](https://github.com/mk3008)! - Expose VACUUM/REINDEX/CLUSTER/CHECKPOINT AST nodes so the testkit can parse dangerous maintenance commands before executing them.

- [#333](https://github.com/mk3008/rawsql-ts/pull/333) [`07735e5`](https://github.com/mk3008/rawsql-ts/commit/07735e5937fe7d78cffab9d47c213d78fcf24a0c) Thanks [@mk3008](https://github.com/mk3008)! - `SqlParser` (and the formatter) now understand `CREATE SCHEMA` and `DROP SCHEMA` statements, so schema DDL can be parsed/formatted just like other DDL types.

- [#316](https://github.com/mk3008/rawsql-ts/pull/316) [`e8c7eed`](https://github.com/mk3008/rawsql-ts/commit/e8c7eedc454ee11205c5a117d7bf70a2dfdcc4f5) Thanks [@mk3008](https://github.com/mk3008)! - Fix DDL fixture generation to honor column defaults defined via ALTER TABLE.

  Column defaults set with `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT ...` are now applied when deriving fixtures from DDL.
  Defaults added outside `CREATE TABLE`, including sequence-backed values like `nextval(...)` and non-sequence defaults such as `now()`, are correctly reflected in column metadata and used for omitted INSERT values.

- [#314](https://github.com/mk3008/rawsql-ts/pull/314) [`e8f025a`](https://github.com/mk3008/rawsql-ts/commit/e8f025afc95004966d0a5f89f5d167bc77ffbeec) Thanks [@mk3008](https://github.com/mk3008)! - Fixed incorrect tokenization of Postgres-style positional parameters (`$1, $2`).

  The SQL Server MONEY literal detector mistakenly treated the comma after `$1` as part of a numeric literal.
  MONEY detection is now limited to cases where `,` or `.` is followed by a digit, allowing `$1, $2` to be tokenized correctly as parameter + comma + parameter.

  Added regression tests for positional parameters in the parser and token readers.

### Patch Changes

- [#348](https://github.com/mk3008/rawsql-ts/pull/348) [`e3c97e4`](https://github.com/mk3008/rawsql-ts/commit/e3c97e44ce38e12a21a2a777ea504fd142738037) Thanks [@mk3008](https://github.com/mk3008)! - This change introduces better typing for keyword comments (legacy vs positioned) across the command, explain, order-by, select, and using parsers so the scheduler can retain comment metadata during DDL/SQL rewrites.

- [#348](https://github.com/mk3008/rawsql-ts/pull/348) [`f73ed38`](https://github.com/mk3008/rawsql-ts/commit/f73ed380e888477789efbf27417d8d3451093218) Thanks [@mk3008](https://github.com/mk3008)! - - Add parser regression tests for `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY` so the core grammar keeps producing AST nodes that downstream guards can inspect for dangerous DDL.

- [#361](https://github.com/mk3008/rawsql-ts/pull/361) [`7dde2ab`](https://github.com/mk3008/rawsql-ts/commit/7dde2ab139c9029eb4b87e521bc91cb881695791) Thanks [@mk3008](https://github.com/mk3008)! - RETURNING list indentation
  - RETURNING clause items now format on their own indented lines in multiline output, matching SELECT list layout.

- [#331](https://github.com/mk3008/rawsql-ts/pull/331) [`88a48d6`](https://github.com/mk3008/rawsql-ts/commit/88a48d63598f941aead4143c0ffeb05792e0af4e) Thanks [@mk3008](https://github.com/mk3008)! - Positional placeholders inside multi-row VALUES clauses are preserved instead of being reclassified as SQL Server MONEY literals so INSERT parsing works with repeated `$n` tokens.

- [#357](https://github.com/mk3008/rawsql-ts/pull/357) [`440133a`](https://github.com/mk3008/rawsql-ts/commit/440133ac48043af3da66cdfa73842a24c5142d84) Thanks [@mk3008](https://github.com/mk3008)! - Support writable CTE parsing
  - CTE bodies can now use INSERT, UPDATE, or DELETE statements with RETURNING.
  - Column and table collectors now reflect RETURNING outputs for writable CTEs.

- [#348](https://github.com/mk3008/rawsql-ts/pull/348) [`7ac3280`](https://github.com/mk3008/rawsql-ts/commit/7ac328069c5458abd68a5ae78e8b791984a23b57) Thanks [@mk3008](https://github.com/mk3008)! - Rename the benchmark workspace to `benchmarks/ztd-bench-vs-raw` and add the `pnpm ztd:bench:pg-testkit-mode` helper so the pg-testkit comparison runners keep using the right path.

## 0.13.3

## 0.13.2

### Patch Changes

- [#294](https://github.com/mk3008/rawsql-ts/pull/294) [`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f) Thanks [@mk3008](https://github.com/mk3008)! - Ensure published packages always include built `dist/` artifacts by building during the `prepack` lifecycle (and in the publish workflow). This fixes cases where `npx ztd init` fails with `MODULE_NOT_FOUND` due to missing compiled entrypoints.

## 0.13.1

### Patch Changes

- [`b01df7d`](https://github.com/mk3008/rawsql-ts/commit/b01df7dca83023e768c119162c8c5f39e39b74be) Thanks [@mk3008](https://github.com/mk3008)! - Patch release to address dependency security advisories by updating Prisma tooling and ESLint, and pinning patched transitive versions via pnpm overrides.

## 0.13.0

### Minor Changes

- Update ztd-cli and perform internal refactors and fixes across the workspace.
