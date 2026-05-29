# @rawsql-ts/ddl-docs-cli

## 0.3.1

### Patch Changes

- Updated dependencies [[`95cf764`](https://github.com/mk3008/rawsql-ts/commit/95cf764a6ed70ec158f594f023354bfc9bc81110)]:
  - rawsql-ts@0.22.0

## 0.3.0

### Minor Changes

- [#819](https://github.com/mk3008/rawsql-ts/pull/819) [`bb53286`](https://github.com/mk3008/rawsql-ts/commit/bb53286ccd4379b5676b790314616049357e0f51) Thanks [@mk3008](https://github.com/mk3008)! - Add DDL review metadata support for table documentation workflows.

  The CLI now includes a `check` command that validates table docs metadata, DDL relationship metadata, DDL order metadata, and concept relationship references against discovered DDL objects. Generated table docs can also render review-only design intent, related concepts, related processes, and generated Concept/Process source pages when relationship metadata is provided.

- [#824](https://github.com/mk3008/rawsql-ts/pull/824) [`a4ba2d9`](https://github.com/mk3008/rawsql-ts/commit/a4ba2d969133fecb031626aab88488cf052c5df7) Thanks [@mk3008](https://github.com/mk3008)! - Add Concept Spec and DFD review site generation support to the DDL docs workflow, including relationship-aware generated pages, review reports, schema summaries, DFD business views, and transfer docs drift checks.

- [#823](https://github.com/mk3008/rawsql-ts/pull/823) [`4812f79`](https://github.com/mk3008/rawsql-ts/commit/4812f7944e49d61bcd68da8b423e668065e8f942) Thanks [@mk3008](https://github.com/mk3008)! - Add Concept Map generation and drift checking from concept relationship metadata.

  The `ddl-docs concept-map` command now renders a human review index from `concept-relationship.json`, and `ddl-docs check` can compare a generated Concept Map with the structured metadata to catch stale review documents.

- [#836](https://github.com/mk3008/rawsql-ts/pull/836) [`8d82bdf`](https://github.com/mk3008/rawsql-ts/commit/8d82bdfb00d3c18c2b188ee17130879f6aabc63b) Thanks [@mk3008](https://github.com/mk3008)! - Add optional structured Concept Spec package messaging.

  Structured Concept Specs can now define `message.tagline` and `message.supportingLine` for package-level concepts or documentation concepts that need a short positioning promise before the detailed concept boundary. Generated concept pages render the message as a dedicated `Message` section, and validation rejects empty message fields when the message object is present.

- [#823](https://github.com/mk3008/rawsql-ts/pull/823) [`a707e04`](https://github.com/mk3008/rawsql-ts/commit/a707e0496f9079a862b40cbbdd01ba115d8d448f) Thanks [@mk3008](https://github.com/mk3008)! - Add a `ddl-docs concept-site` command that generates VitePress-ready Concept Spec review pages from Concept Spec source files and concept relationship metadata. Generated concept pages now include related concept links and glossary terms from structured metadata.

- [#823](https://github.com/mk3008/rawsql-ts/pull/823) [`8cb8f26`](https://github.com/mk3008/rawsql-ts/commit/8cb8f260274840f0c382cacad07579d13adf1a73) Thanks [@mk3008](https://github.com/mk3008)! - Add a `--table-docs` option for review-only table documentation metadata.

  Generated table definition pages can now render column samples from external JSON metadata in a `Sample` column before `Comment`, without requiring those examples to be stored in database comments.

- [#826](https://github.com/mk3008/rawsql-ts/pull/826) [`c1b5a92`](https://github.com/mk3008/rawsql-ts/commit/c1b5a924f03a0bb67c289a23779262730bc2ef99) Thanks [@mk3008](https://github.com/mk3008)! - Add package verification policy support to ddl-docs metadata checks and review plans.

  The `check` command now accepts optional `--test-rules` metadata and validates package-level verification policy structure. The `review-plan` command can include `--test-policy` and `--test-rules` so generated review input identifies mandatory verification policy files and per-artifact test policy reads without treating generated docs as source of truth.

- [#825](https://github.com/mk3008/rawsql-ts/pull/825) [`042535b`](https://github.com/mk3008/rawsql-ts/commit/042535bdce0122a61bedcf56fa8dbfe4b4d4f6e6) Thanks [@mk3008](https://github.com/mk3008)! - Add package scope rule validation and deterministic review-plan generation.

  `ddl-docs check` can now validate package-level scope rules and DDL relationship references to those rules, while `ddl-docs review-plan` emits review input JSON from changed files so AI and human reviews can read the relevant scope rules, concepts, DFDs, process maps, and DDL relationship metadata without rediscovering them by inference.

- [#823](https://github.com/mk3008/rawsql-ts/pull/823) [`83822ad`](https://github.com/mk3008/rawsql-ts/commit/83822ad65ee5f7bbfb46019876bd2a757c68e44e) Thanks [@mk3008](https://github.com/mk3008)! - Add Concept Spec and DFD review-site generation support, including subsystem and business pages, business-owned process links, relationship metadata validation, and cleaner generated Concept/DFD navigation.

- [#833](https://github.com/mk3008/rawsql-ts/pull/833) [`40a941a`](https://github.com/mk3008/rawsql-ts/commit/40a941ae3cedeca75f84f7e1af2343dc99a12f78) Thanks [@mk3008](https://github.com/mk3008)! - Add structured concept review generation for concept.json sources, including deterministic VitePress pages, concept relationship indexes, AI context output, display-name updates, and stricter Concept/DFD/Process Map cross-reference checks.

### Patch Changes

- [#823](https://github.com/mk3008/rawsql-ts/pull/823) [`eaa85f7`](https://github.com/mk3008/rawsql-ts/commit/eaa85f764d1f952560407c22dd2c91c18647d9c0) Thanks [@mk3008](https://github.com/mk3008)! - Add DFD pages and role index generation to the concept-site output, with roles extracted from Mermaid `Who:` nodes instead of duplicated scope tables.

  The generated VitePress preview now supports Mermaid rendering for concept/process/DFD source pages and can include DFD and role navigation when DFD relationship metadata is provided.

- Updated dependencies [[`167a557`](https://github.com/mk3008/rawsql-ts/commit/167a55772977da9b4b0a7f75afca37d972aed779), [`21bce06`](https://github.com/mk3008/rawsql-ts/commit/21bce0606888748b9c584c2a597f520f4d25602a), [`8d82bdf`](https://github.com/mk3008/rawsql-ts/commit/8d82bdfb00d3c18c2b188ee17130879f6aabc63b)]:
  - rawsql-ts@0.21.0

## 0.2.7

### Patch Changes

- Updated dependencies [[`e9e425f`](https://github.com/mk3008/rawsql-ts/commit/e9e425f77b51402fcca03393305ac36bc99d7576), [`6a1cb41`](https://github.com/mk3008/rawsql-ts/commit/6a1cb415366f3b8c0650f1caac67d9235ed1a130)]:
  - rawsql-ts@0.20.0

## 0.2.6

### Patch Changes

- Updated dependencies [[`6bf1fcc`](https://github.com/mk3008/rawsql-ts/commit/6bf1fccfcf3cdce4b74cc42ef3d086c54defb54b)]:
  - rawsql-ts@0.19.0

## 0.2.5

### Patch Changes

- Updated dependencies [[`be9b689`](https://github.com/mk3008/rawsql-ts/commit/be9b6893ff42f783f9cb52f1b8cd9cdc6c120e23)]:
  - rawsql-ts@0.18.0

## 0.2.4

### Patch Changes

- [#634](https://github.com/mk3008/rawsql-ts/pull/634) [`d0c63f2`](https://github.com/mk3008/rawsql-ts/commit/d0c63f22298f8ec1aa6e23d783e986c07cf0285d) Thanks [@mk3008](https://github.com/mk3008)! - Add repository metadata to the ddl-docs packages so npm Trusted Publishing provenance validation can verify the package source during release.

## 0.2.3

### Patch Changes

- [#628](https://github.com/mk3008/rawsql-ts/pull/628) [`5d15113`](https://github.com/mk3008/rawsql-ts/commit/5d151130b492b0bfbb787a1410ceb1eeee0683e6) Thanks [@mk3008](https://github.com/mk3008)! - Replace workspace-only dependency ranges in published package manifests with publishable semver ranges so standalone consumers can install these packages without workspace resolution errors.

## 0.2.2

### Patch Changes

- Updated dependencies [[`b56a3fa`](https://github.com/mk3008/rawsql-ts/commit/b56a3fa82763c4120f73b2cec9f295c55c951609)]:
  - rawsql-ts@0.17.0

## 0.2.1

### Patch Changes

- [#513](https://github.com/mk3008/rawsql-ts/pull/513) [`f0c1c32`](https://github.com/mk3008/rawsql-ts/commit/f0c1c327fe8e0f4cc917d0c2d8013391bdd9185d) Thanks [@mk3008](https://github.com/mk3008)! - Fix the published CLI entrypoint metadata so the package points at the generated dist/src/index.js output.

  This keeps local pack and publish flows from failing in prepack after a successful build.

## 0.2.0

### Minor Changes

- [#449](https://github.com/mk3008/rawsql-ts/pull/449) [`e960404`](https://github.com/mk3008/rawsql-ts/commit/e96040413ce357c0c86fe87f886b9d8cce6cb44e) Thanks [@mk3008](https://github.com/mk3008)! - Add a new `@rawsql-ts/ddl-docs-cli` package that generates schema/table Markdown documentation from DDL files using rawsql-ts parsing.

- [#453](https://github.com/mk3008/rawsql-ts/pull/453) [`9f333e5`](https://github.com/mk3008/rawsql-ts/commit/9f333e5f7a686b3d0e469508cb0a3a9b2486d895) Thanks [@mk3008](https://github.com/mk3008)! - Add a new "filter pg_dump" workflow for DDL docs generation and introduce a publishable VitePress scaffold CLI.

  `@rawsql-ts/ddl-docs-cli` now supports `--filter-pg-dump` for `generate`, which strips administrative pg_dump statements (for example GRANT/REVOKE, OWNER changes, SET, and `\connect`) before parsing.

  `@rawsql-ts/ddl-docs-vitepress` is now packaged as a scaffold generator with `ddl-docs-vitepress init`. The init flow is safe by default, supports overwrite-only mode with `--force`, explicit destructive cleanup with `--force --clean`, and improved help output via `help`, `--help`, and `init --help`.

### Patch Changes

- Updated dependencies [[`e960404`](https://github.com/mk3008/rawsql-ts/commit/e96040413ce357c0c86fe87f886b9d8cce6cb44e)]:
  - rawsql-ts@0.16.1

## 0.1.0

- Initial release of the DDL-to-Markdown documentation CLI.
