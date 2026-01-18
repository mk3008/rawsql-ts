# @rawsql-ts/testkit-postgres

## 0.15.1

### Patch Changes

- Renamed `@rawsql-ts/pg-testkit` to `@rawsql-ts/testkit-postgres` and removed the direct `pg` runtime dependency by introducing a driver-agnostic QueryExecutor boundary.
- Added the `@rawsql-ts/adapter-node-pg` package so Node’s `pg` driver can reuse the same fixture/rewriter core without impacting other executors.
- Reworked diagnostics and fixture validation tests to run without Docker while keeping the rewritten SQL behavior intact.

## 0.15.0

### Patch Changes

- Updated dependencies [[`8fc296a`](https://github.com/mk3008/rawsql-ts/commit/8fc296a24f1dc8190c3561bc265f5b32d537eab3), [`ee41f6d`](https://github.com/mk3008/rawsql-ts/commit/ee41f6d270c8174f0c6128ece3f3abd55a726f3d), [`45c55bd`](https://github.com/mk3008/rawsql-ts/commit/45c55bd58f0e1b969ce7bcc6cc35d53d2248ebdd), [`efc6e3f`](https://github.com/mk3008/rawsql-ts/commit/efc6e3fd2c1a9dec3bc54ed446101ed53191fea3)]:
  - @rawsql-ts/testkit-core@0.15.0
  - rawsql-ts@0.15.0

## 0.14.4

### Patch Changes

- Updated dependencies []:
  - rawsql-ts@0.14.4
  - @rawsql-ts/testkit-core@0.14.4

## 0.14.3

### Patch Changes

- Updated dependencies [[`1cfcc2a`](https://github.com/mk3008/rawsql-ts/commit/1cfcc2ab7502b9f01f4ba53d8e8540b8ca40e3d7)]:
  - rawsql-ts@0.14.3
  - @rawsql-ts/testkit-core@0.14.3

## 0.14.2

### Patch Changes

- Updated dependencies []:
  - rawsql-ts@0.14.2
  - @rawsql-ts/testkit-core@0.14.2

## 0.14.1

### Patch Changes

- Updated dependencies [[`0746dce`](https://github.com/mk3008/rawsql-ts/commit/0746dceb58ae2270feab896d1f1a2caf64ec338f)]:
  - @rawsql-ts/testkit-core@0.14.1
  - rawsql-ts@0.14.1

## 0.14.0

### Patch Changes

- Updated dependencies [[`e3c97e4`](https://github.com/mk3008/rawsql-ts/commit/e3c97e44ce38e12a21a2a777ea504fd142738037), [`f73ed38`](https://github.com/mk3008/rawsql-ts/commit/f73ed380e888477789efbf27417d8d3451093218), [`18e8ef2`](https://github.com/mk3008/rawsql-ts/commit/18e8ef20ed1c2147e15f807eb91c0f61eb5481ae), [`963a1d1`](https://github.com/mk3008/rawsql-ts/commit/963a1d141612b981a344858fe9b1a2888a28f049), [`07735e5`](https://github.com/mk3008/rawsql-ts/commit/07735e5937fe7d78cffab9d47c213d78fcf24a0c), [`7dde2ab`](https://github.com/mk3008/rawsql-ts/commit/7dde2ab139c9029eb4b87e521bc91cb881695791), [`e8c7eed`](https://github.com/mk3008/rawsql-ts/commit/e8c7eedc454ee11205c5a117d7bf70a2dfdcc4f5), [`88a48d6`](https://github.com/mk3008/rawsql-ts/commit/88a48d63598f941aead4143c0ffeb05792e0af4e), [`e8f025a`](https://github.com/mk3008/rawsql-ts/commit/e8f025afc95004966d0a5f89f5d167bc77ffbeec), [`440133a`](https://github.com/mk3008/rawsql-ts/commit/440133ac48043af3da66cdfa73842a24c5142d84), [`7ac3280`](https://github.com/mk3008/rawsql-ts/commit/7ac328069c5458abd68a5ae78e8b791984a23b57)]:
  - rawsql-ts@0.14.0
  - @rawsql-ts/testkit-core@0.14.0

## 0.13.3

### Patch Changes

- Updated dependencies []:
  - rawsql-ts@0.13.3
  - @rawsql-ts/testkit-core@0.13.3

## 0.13.2

### Patch Changes

- [#294](https://github.com/mk3008/rawsql-ts/pull/294) [`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f) Thanks [@mk3008](https://github.com/mk3008)!
  - Ensure published packages always include built `dist/` artifacts by building during the `prepack` lifecycle (and in the publish workflow). This fixes cases where `npx ztd init` fails with `MODULE_NOT_FOUND` due to missing compiled entrypoints.

- Updated dependencies [[`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f), [`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f)]:
  - rawsql-ts@0.13.2
  - @rawsql-ts/testkit-core@0.13.2

## 0.13.1

### Patch Changes

- [`b01df7d`](https://github.com/mk3008/rawsql-ts/commit/b01df7dca83023e768c119162c8c5f39e39b74be) Thanks [@mk3008](https://github.com/mk3008)!
  - Patch release to address dependency security advisories by updating Prisma tooling and ESLint, and pinning patched transitive versions via pnpm overrides.

- Updated dependencies [[`b01df7d`](https://github.com/mk3008/rawsql-ts/commit/b01df7dca83023e768c119162c8c5f39e39b74be)]:
  - rawsql-ts@0.13.1
  - @rawsql-ts/testkit-core@0.13.1

## 0.13.0

### Minor Changes

- Update ztd-cli and perform internal refactors and fixes across the workspace.

### Patch Changes

- Updated dependencies []:
  - rawsql-ts@0.13.0
  - @rawsql-ts/testkit-core@0.13.0
