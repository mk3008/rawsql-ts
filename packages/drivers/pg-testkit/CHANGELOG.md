# @rawsql-ts/pg-testkit

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

- [#294](https://github.com/mk3008/rawsql-ts/pull/294) [`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f) Thanks [@mk3008](https://github.com/mk3008)! - Ensure published packages always include built `dist/` artifacts by building during the `prepack` lifecycle (and in the publish workflow). This fixes cases where `npx ztd init` fails with `MODULE_NOT_FOUND` due to missing compiled entrypoints.

- [#294](https://github.com/mk3008/rawsql-ts/pull/294) [`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f) Thanks [@mk3008](https://github.com/mk3008)! - Ensure published packages always include built dist artifacts.

- Updated dependencies [[`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f), [`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f)]:
  - rawsql-ts@0.13.2
  - @rawsql-ts/testkit-core@0.13.2

## 0.13.1

### Patch Changes

- [`b01df7d`](https://github.com/mk3008/rawsql-ts/commit/b01df7dca83023e768c119162c8c5f39e39b74be) Thanks [@mk3008](https://github.com/mk3008)! - Patch release to address dependency security advisories by updating Prisma tooling and ESLint, and pinning patched transitive versions via pnpm overrides.

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
