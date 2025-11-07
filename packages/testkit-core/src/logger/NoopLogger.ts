import type { TestkitLogger } from '../types';

export class NoopLogger implements TestkitLogger {
  // Intentionally empty implementations to keep optional logging lightweight.
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

export const createLogger = (logger?: TestkitLogger): TestkitLogger => {
  return logger ?? new NoopLogger();
};
