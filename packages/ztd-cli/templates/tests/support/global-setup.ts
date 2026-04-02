/**
 * Vitest global setup.
 *
 * Environment loading happens in .ztd/support/setup-env.ts.
 * Keep this hook available for teams that later add SQL-backed integration setup.
 */
export default async function globalSetup() {
  return () => undefined;
}
