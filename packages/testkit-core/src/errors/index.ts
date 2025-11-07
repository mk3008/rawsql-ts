export class MissingFixtureError extends Error {
  constructor(public readonly tableName: string) {
    super(`Fixture for table "${tableName}" was not provided.`);
    this.name = 'MissingFixtureError';
  }
}

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

export class QueryRewriteError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'QueryRewriteError';
  }
}
