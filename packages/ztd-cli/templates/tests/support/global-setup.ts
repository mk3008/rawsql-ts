/**
 * Vitest global setup.
 *
 * This hook warns when ZTD_TEST_DATABASE_URL is missing so the developer remembers
 * to provide the ZTD-owned test database connection before running SQL-backed tests.
 */
export default async function globalSetup() {
  const configuredUrl = process.env.ZTD_TEST_DATABASE_URL?.trim();
  if (!configuredUrl) {
    console.warn(
      'ZTD_TEST_DATABASE_URL is not configured. SQL-backed tests will need a driver plus a ZTD-owned test database connection before they can run.',
    );
  }
  return () => undefined;
}
