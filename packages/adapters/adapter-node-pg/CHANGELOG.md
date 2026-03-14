# @rawsql-ts/adapter-node-pg

## 0.15.4

### Patch Changes

- Updated dependencies [[`b56a3fa`](https://github.com/mk3008/rawsql-ts/commit/b56a3fa82763c4120f73b2cec9f295c55c951609)]:
  - rawsql-ts@0.17.0
  - @rawsql-ts/testkit-core@0.16.1
  - @rawsql-ts/testkit-postgres@0.15.3

## 0.15.3

### Patch Changes

- [#439](https://github.com/mk3008/rawsql-ts/pull/439) [`8acdf88`](https://github.com/mk3008/rawsql-ts/commit/8acdf88ebc743d1ce1ed3c85c9b085c6b8456afc) Thanks [@mk3008](https://github.com/mk3008)! - Rename the internal binder dependency to `@rawsql-ts/shared-binder` so npm publish accepts the package metadata.

- Updated dependencies [[`1cb9aef`](https://github.com/mk3008/rawsql-ts/commit/1cb9aef7402d00f19a8bebe416f845b9efd36a88), [`ad95b97`](https://github.com/mk3008/rawsql-ts/commit/ad95b971e77101f4cdfc37aa28e2817b0a6903bf), [`e960404`](https://github.com/mk3008/rawsql-ts/commit/e96040413ce357c0c86fe87f886b9d8cce6cb44e)]:
  - @rawsql-ts/shared-binder@0.0.1
  - @rawsql-ts/testkit-core@0.16.0
  - rawsql-ts@0.16.1
  - @rawsql-ts/testkit-postgres@0.15.2

## 0.15.2

### Patch Changes

- [#433](https://github.com/mk3008/rawsql-ts/pull/433) [`36fd789`](https://github.com/mk3008/rawsql-ts/commit/36fd7898926abf318873350ec3aeb5a28a60e021) Thanks [@mk3008](https://github.com/mk3008)! - Adopt SQL-first scaffolding with named-parameter SQL layout in the ZTD template, and compile named parameters to indexed placeholders in the pg adapter.

## 0.15.1

### Patch Changes

- [#412](https://github.com/mk3008/rawsql-ts/pull/412) [`9c05224`](https://github.com/mk3008/rawsql-ts/commit/9c052243a8005b8882e88f50b7d469ac7c55b24e) Thanks [@mk3008](https://github.com/mk3008)! - Split the Postgres fixture core out of pg-testkit and add the new Node pg adapter so the driver metadata stays accurate.

- Updated dependencies [[`1ad78c5`](https://github.com/mk3008/rawsql-ts/commit/1ad78c5430b2ac24e0fb8fe6fb6ecf913e9b9e54), [`857a3c3`](https://github.com/mk3008/rawsql-ts/commit/857a3c3f21e32610024aa51f636841f9ff9e4ce4), [`84ec3a0`](https://github.com/mk3008/rawsql-ts/commit/84ec3a0c5f3e16463c1eee532fc9570bf1bcff93), [`2361f3c`](https://github.com/mk3008/rawsql-ts/commit/2361f3cbdf7589984bbbe7779ffb5d8129ff3804), [`9c05224`](https://github.com/mk3008/rawsql-ts/commit/9c052243a8005b8882e88f50b7d469ac7c55b24e), [`fc7a80e`](https://github.com/mk3008/rawsql-ts/commit/fc7a80e237850dc3c5f06dd7c8ad5472af1e3dc8), [`e38df03`](https://github.com/mk3008/rawsql-ts/commit/e38df035cc8301b24a4fdfaab9d1cbbaa9d95c0a), [`f957e21`](https://github.com/mk3008/rawsql-ts/commit/f957e219ab5f1f27df2bc771fc25032ccf35f226), [`ba24150`](https://github.com/mk3008/rawsql-ts/commit/ba24150112a08ae5e80fc43533f7c5d47d8e3a81)]:
  - rawsql-ts@0.16.0
  - @rawsql-ts/testkit-postgres@0.15.1
  - @rawsql-ts/testkit-core@0.15.1

## 0.15.0

### Minor Changes

- Introduced the new Node `pg` adapter that exposes `createPgTestkitClient`, `createPgTestkitPool`, and `wrapPgClient` while reusing the fixture/rewriter core located in `@rawsql-ts/testkit-postgres`.
