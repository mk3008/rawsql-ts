/**
 * Vitest global setup.
 *
 * This hook warns when DATABASE_URL is missing so the developer remembers to
 * install an adapter or provide a connection before running SQL-backed tests.
 */
export default async function globalSetup() {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (!configuredUrl) {
    console.warn(
      'DATABASE_URL is not configured. Install a database adapter or set DATABASE_URL before running SQL-backed tests.',
    );
  }
  return () => undefined;
}
