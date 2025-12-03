import { PostgreSqlContainer } from '@testcontainers/postgresql';

interface GlobalSetupContextLike {
  provide: (key: string, value: string) => void;
}

const POSTGRES_IMAGE = 'postgres:16-alpine';
type StartedPostgresContainer = Awaited<ReturnType<PostgreSqlContainer['start']>>;

function isMissingRuntimeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Could not find a working container runtime strategy')
  );
}

export default async function setupGlobalPostgres({ provide }: GlobalSetupContextLike) {
  if (process.env.TEST_PG_URI) {
    // Respect externally supplied connections and skip container creation.
    return async () => {};
  }

  let cleanup = async () => {};
  const container = new PostgreSqlContainer(POSTGRES_IMAGE);

  let startedContainer: StartedPostgresContainer | undefined;

  try {
    // Start a shared Postgres container for the entire Vitest run.
    startedContainer = await container.start();
    const connectionUri = startedContainer.getConnectionUri();
    provide('TEST_PG_URI', connectionUri);
    process.env.TEST_PG_URI = connectionUri;

    cleanup = async () => {
      // Ensure the container is stopped after all suites complete.
      await startedContainer?.stop();
    };
  } catch (error) {
    if (isMissingRuntimeError(error)) {
      console.warn('Skipping Postgres fixture because no container runtime is available.');
      return cleanup;
    }
    throw error;
  }

  return cleanup;
}
