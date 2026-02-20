import { alphaCatalog, emailCatalog } from './testCaseCatalogs';
import { activeOrdersSqlCases } from './sql/activeOrders';
import { sampleSqlCatalog } from './sql/sample';

/**
 * Aggregated executable test-case catalogs.
 */
export const testCaseCatalogs = [emailCatalog, alphaCatalog];

/**
 * Aggregated SQL catalog test specifications.
 */
export const sqlCatalogCases = [activeOrdersSqlCases, sampleSqlCatalog];

/**
 * Re-exported sample SQL catalog for direct imports from this entrypoint.
 */
export { sampleSqlCatalog } from './sql/sample';
