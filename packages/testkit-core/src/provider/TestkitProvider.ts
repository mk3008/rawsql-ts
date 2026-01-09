import type { TableFixture } from '../types';

/** Supported connection reuse strategies exposed by the provider. */
export type ConnectionStrategy = 'shared' | 'perTest';

/** Minimum subset of a connection required by the provider. */
export type TestkitConnection = {
  query(sql: string, values?: unknown[]): Promise<unknown>;
};

/** Custom hook invoked after a shared scenario to reset session state. */
export type ConnectionResetHook<TConnection extends TestkitConnection> = (
  connection: TConnection
) => Promise<void> | void;

/**
 * Options that determine how the shared connection is cleaned up between scenarios.
 */
export type ConnectionResetOption<TConnection extends TestkitConnection> =
  | 'transaction'
  | 'none'
  | ConnectionResetHook<TConnection>;

/**
 * Configuration required to construct a `TestkitProvider`.
 */
export interface CreateTestkitProviderOptions<
  TConnection extends TestkitConnection,
  TResource
> {
  connectionFactory: () => Promise<TConnection>;
  resourceFactory: (
    connection: TConnection,
    fixtures: TableFixture[]
  ) => Promise<TResource> | TResource;
  strategy?: ConnectionStrategy;
  reset?: ConnectionResetOption<TConnection>;
  releaseResource?: (resource: TResource) => Promise<void> | void;
  disposeConnection?: (connection: TConnection) => Promise<void> | void;
}

type PerTestAccessor<TResource> = {
  withRepositoryFixture<Result>(
    fixtures: TableFixture[],
    callback: (resource: TResource) => Promise<Result> | Result
  ): Promise<Result>;
};

const DEFAULT_STRATEGY: ConnectionStrategy = 'shared';
const DEFAULT_RESET: ConnectionResetOption<TestkitConnection> = 'transaction';

const defaultDisposeConnection = async (
  connection: TestkitConnection
): Promise<void> => {
  const closable = connection as Partial<{
    release(): void;
    end(): Promise<void> | void;
  }>;
  if (typeof closable.release === 'function') {
    closable.release();
    return;
  }
  if (typeof closable.end === 'function') {
    await closable.end();
  }
};

/**
 * Manages connection recycling for ZTD repositories by wiring fixtures into
 * shared or per-test sessions.
 */
export class TestkitProvider<
  TConnection extends TestkitConnection,
  TResource
> {
  private sharedConnectionPromise?: Promise<TConnection>;
  private sharedConnection?: TConnection;
  private closed = false;
  private sharedQueue: Promise<void> = Promise.resolve();

  private readonly releaseResource: (
    resource: TResource
  ) => Promise<void> | void;
  private readonly disposeConnection: (
    connection: TConnection
  ) => Promise<void> | void;

  constructor(private readonly options: CreateTestkitProviderOptions<TConnection, TResource>) {
    this.releaseResource = options.releaseResource ?? (() => undefined);
    this.disposeConnection =
      options.disposeConnection ??
      (async (connection) => defaultDisposeConnection(connection));
  }

  public withRepositoryFixture<Result>(
    fixtures: TableFixture[],
    callback: (resource: TResource) => Promise<Result> | Result,
    overrides?: { strategy?: ConnectionStrategy }
  ): Promise<Result> {
    this.ensureNotClosed();
    const strategy = overrides?.strategy ?? this.options.strategy ?? DEFAULT_STRATEGY;
    if (strategy === 'perTest') {
      // Use a fresh connection for every invocation to keep session state isolated.
      return this.runWithPerTestConnection(fixtures, callback);
    }
    // The shared path reuses a single connection and applies the configured reset.
    return this.runWithSharedConnection(fixtures, callback);
  }

  public perTest(): PerTestAccessor<TResource> {
    return {
      withRepositoryFixture: (fixtures, callback) =>
        this.withRepositoryFixture(fixtures, callback, { strategy: 'perTest' }),
    };
  }

  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    // Ensure no shared scenario is still running before cleanup.
    await this.sharedQueue.catch(() => undefined);
    if (!this.sharedConnectionPromise) {
      return;
    }
    // Wait for the shared connection to settle before disposing it.
    const connection = await this.sharedConnectionPromise;
    await this.disposeConnection(connection);
  }

  private async runWithSharedConnection<Result>(
    fixtures: TableFixture[],
    callback: (resource: TResource) => Promise<Result> | Result
  ): Promise<Result> {
    const runScenario = async (): Promise<Result> => {
      const connection = await this.ensureSharedConnection();
      const resetOption = this.options.reset ?? DEFAULT_RESET;
      const transactionStarted = await this.beginTransactionIfNeeded(
        connection,
        resetOption
      );
      let resource: TResource | undefined;
      try {
        // Create the resource tied to this shared connection before invoking the callback.
        resource = await this.options.resourceFactory(connection, fixtures);
        return await callback(resource);
      } finally {
        if (resource !== undefined) {
          await this.releaseResource(resource);
        }
        // Run the configured reset after the scenario so the connection stays clean.
        await this.executeReset(connection, resetOption, transactionStarted);
      }
    };

    // Serialize shared usage so scenarios never run in parallel.
    const next = this.sharedQueue.catch(() => undefined);
    const task = next.then(() => runScenario());
    this.sharedQueue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  private async runWithPerTestConnection<Result>(
    fixtures: TableFixture[],
    callback: (resource: TResource) => Promise<Result> | Result
  ): Promise<Result> {
    const connection = await this.options.connectionFactory();
    try {
      // Every invocation gets a new connection that is disposed afterward.
      const resource = await this.options.resourceFactory(connection, fixtures);
      try {
        return await callback(resource);
      } finally {
        await this.releaseResource(resource);
      }
    } finally {
      // Tear down the transient connection once the callback completes.
      await this.disposeConnection(connection);
    }
  }

  private async beginTransactionIfNeeded(
    connection: TConnection,
    resetOption: ConnectionResetOption<TConnection>
  ): Promise<boolean> {
    if (resetOption !== 'transaction') {
      return false;
    }
    // Wrap the scenario in a transaction so it can be rolled back later.
    await connection.query('BEGIN');
    return true;
  }

  private async executeReset(
    connection: TConnection,
    resetOption: ConnectionResetOption<TConnection>,
    transactionStarted: boolean
  ): Promise<void> {
    if (resetOption === 'transaction' && transactionStarted) {
      // Roll the prior transaction back to keep the shared connection clean.
      await connection.query('ROLLBACK');
      return;
    }
    if (typeof resetOption === 'function') {
      // Invoke the custom reset hook after each shared scenario.
      await resetOption(connection);
    }
  }

  private async ensureSharedConnection(): Promise<TConnection> {
    if (this.sharedConnectionPromise) {
      return this.sharedConnectionPromise;
    }
    // Cache the single shared connection so concurrent callers reuse it.
    this.sharedConnectionPromise = (async () => {
      const connection = await this.options.connectionFactory();
      this.sharedConnection = connection;
      return connection;
    })();
    return this.sharedConnectionPromise;
  }

  private ensureNotClosed(): void {
    if (this.closed) {
      // Prevent operations after the provider has been shut down.
      throw new Error('TestkitProvider is already closed.');
    }
  }
}

/**
 * Instantiates a `TestkitProvider` with the given configuration.
 */
export async function createTestkitProvider<
  TConnection extends TestkitConnection,
  TResource
>(
  options: CreateTestkitProviderOptions<TConnection, TResource>
): Promise<TestkitProvider<TConnection, TResource>> {
  return new TestkitProvider(options);
}
