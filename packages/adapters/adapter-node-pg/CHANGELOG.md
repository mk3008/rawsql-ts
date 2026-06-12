# @rawsql-ts/adapter-node-pg

## 0.15.12

### Patch Changes

- Updated dependencies [[`9015a07`](https://github.com/mk3008/rawsql-ts/commit/9015a07e1b0439b33acabf88ee70d7aabe232877), [`bc7b439`](https://github.com/mk3008/rawsql-ts/commit/bc7b4398b1dc59cca12e6e5789dc3daa42ab4476), [`2e96245`](https://github.com/mk3008/rawsql-ts/commit/2e96245225bb14e5bcec65ae142de877c2494814), [`acc43be`](https://github.com/mk3008/rawsql-ts/commit/acc43bef9c028094859daa1e7c330b128f071a5b)]:
  - rawsql-ts@0.24.0
  - @rawsql-ts/testkit-core@0.17.3
  - @rawsql-ts/testkit-postgres@0.16.3

## 0.15.11

### Patch Changes

- Updated dependencies [[`4698a87`](https://github.com/mk3008/rawsql-ts/commit/4698a87e9a73f8d6b87b0545cb0a740246f7d457)]:
  - rawsql-ts@0.23.0
  - @rawsql-ts/testkit-core@0.17.2
  - @rawsql-ts/testkit-postgres@0.16.2

## 0.15.10

### Patch Changes

- Updated dependencies [[`95cf764`](https://github.com/mk3008/rawsql-ts/commit/95cf764a6ed70ec158f594f023354bfc9bc81110)]:
  - rawsql-ts@0.22.0
  - @rawsql-ts/testkit-core@0.17.1
  - @rawsql-ts/testkit-postgres@0.16.1

## 0.15.9

### Patch Changes

- [#836](https://github.com/mk3008/rawsql-ts/pull/836) [`8d82bdf`](https://github.com/mk3008/rawsql-ts/commit/8d82bdfb00d3c18c2b188ee17130879f6aabc63b) Thanks [@mk3008](https://github.com/mk3008)! - Remove the workspace `@rawsql-ts/sql-contract` package from the standard runtime path.

  `ztd-cli` generated query paths now continue toward runtime-free execution with thin executor calls and AOT generated row mappers. `testkit-postgres` now owns its small query-result normalization shape directly, and the node-pg adapter build no longer depends on the removed package.

- [#837](https://github.com/mk3008/rawsql-ts/pull/837) [`927dc07`](https://github.com/mk3008/rawsql-ts/commit/927dc07efeb6188f286f030e9585f7651517d0fc) Thanks [@mk3008](https://github.com/mk3008)! - Clarify that `@rawsql-ts/adapter-node-pg` is the compatible legacy package name for the node-postgres testkit adapter, not the production driver adapter package space. The docs now separate production `driver-adapter-*` packages from future `testkit-adapter-*` packages and describe the non-breaking rename path toward an alias such as `@rawsql-ts/testkit-adapter-node-postgres`.

- Updated dependencies [[`913e0b2`](https://github.com/mk3008/rawsql-ts/commit/913e0b2ea5d11a82cc0d81db210ce9fe744db3f9), [`167a557`](https://github.com/mk3008/rawsql-ts/commit/167a55772977da9b4b0a7f75afca37d972aed779), [`21bce06`](https://github.com/mk3008/rawsql-ts/commit/21bce0606888748b9c584c2a597f520f4d25602a), [`8d82bdf`](https://github.com/mk3008/rawsql-ts/commit/8d82bdfb00d3c18c2b188ee17130879f6aabc63b), [`8d82bdf`](https://github.com/mk3008/rawsql-ts/commit/8d82bdfb00d3c18c2b188ee17130879f6aabc63b)]:
  - @rawsql-ts/testkit-core@0.17.0
  - @rawsql-ts/testkit-postgres@0.16.0
  - rawsql-ts@0.21.0

## 0.15.8

### Patch Changes

- Updated dependencies [[`e9e425f`](https://github.com/mk3008/rawsql-ts/commit/e9e425f77b51402fcca03393305ac36bc99d7576), [`6a1cb41`](https://github.com/mk3008/rawsql-ts/commit/6a1cb415366f3b8c0650f1caac67d9235ed1a130)]:
  - rawsql-ts@0.20.0
  - @rawsql-ts/testkit-core@0.16.5
  - @rawsql-ts/testkit-postgres@0.15.7

## 0.15.7

### Patch Changes

- Updated dependencies [[`6bf1fcc`](https://github.com/mk3008/rawsql-ts/commit/6bf1fccfcf3cdce4b74cc42ef3d086c54defb54b)]:
  - rawsql-ts@0.19.0
  - @rawsql-ts/testkit-core@0.16.4
  - @rawsql-ts/testkit-postgres@0.15.6

## 0.15.6

### Patch Changes

- Updated dependencies [[`68b385e`](https://github.com/mk3008/rawsql-ts/commit/68b385e0407b8a610078ea4c07ee0c602e6910ed), [`be9b689`](https://github.com/mk3008/rawsql-ts/commit/be9b6893ff42f783f9cb52f1b8cd9cdc6c120e23)]:
  - @rawsql-ts/testkit-core@0.16.3
  - rawsql-ts@0.18.0
  - @rawsql-ts/testkit-postgres@0.15.5

## 0.15.5

### Patch Changes

- [#639](https://github.com/mk3008/rawsql-ts/pull/639) [`a948119`](https://github.com/mk3008/rawsql-ts/commit/a948119b1fcc6ed884d1f939cdbf14132320b638) Thanks [@mk3008](https://github.com/mk3008)! - Fix the published dependency graph for the PostgreSQL adapter tutorial path so standalone consumers can install `@rawsql-ts/adapter-node-pg` without a `workspace:` protocol leak.

- Updated dependencies [[`a948119`](https://github.com/mk3008/rawsql-ts/commit/a948119b1fcc6ed884d1f939cdbf14132320b638)]:
  - @rawsql-ts/testkit-postgres@0.15.4

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
