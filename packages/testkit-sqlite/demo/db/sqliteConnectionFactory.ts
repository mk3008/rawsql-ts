import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import { getDemoSqlitePath } from "../runtime/sqliteConfig";
import type { CustomerRepositoryConnection } from "../types/CustomerRepositoryConnection";

export type BetterSqliteConstructor = new (
  filename: string,
  options?: {
    fileMustExist?: boolean;
    memory?: boolean;
    readonly?: boolean;
    timeout?: number;
  }
) => BetterSqliteDatabase;

let cachedConstructor: BetterSqliteConstructor | undefined;

export const tryResolveBetterSqlite = (): BetterSqliteConstructor | undefined => {
  if (cachedConstructor) {
    return cachedConstructor;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ctor = require("better-sqlite3") as BetterSqliteConstructor;
    const smokeTest = new ctor(":memory:");
    smokeTest.close();
    cachedConstructor = ctor;
    return cachedConstructor;
  } catch (_err) {
    return undefined;
  }
};

export const createDemoConnection = (): CustomerRepositoryConnection => {
  const ctor = tryResolveBetterSqlite();
  if (!ctor) {
    throw new Error(
      "better-sqlite3 is not available - install the optional dependency or provide a custom connection."
    );
  }

  return new ctor(getDemoSqlitePath(), { fileMustExist: true }) as CustomerRepositoryConnection;
};
