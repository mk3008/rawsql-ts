// Temporary shim: keep testkit-sqlite tests decoupled from direct cross-package paths.
// When a shared test utility package is extracted, swap this re-export target.
/**
 * Re-export SQL catalog test utilities for testkit-sqlite test suites.
 */
export {
  defineSqlCatalog,
  runSqlCatalog,
  exportSqlCatalogEvidence,
  type SqlCatalog,
  type SqlCatalogExecutor,
  type RunSqlCatalogOptions,
} from '../../../ztd-cli/tests/utils/sqlCatalog';
