import { config as loadEnv } from "dotenv";
import path from "node:path";

const envPath = path.resolve(__dirname, "../.env.demo");
loadEnv({ path: envPath });

const sqlitePath = process.env.SQLITE_PATH;

const resolvedPath = sqlitePath
  ? path.isAbsolute(sqlitePath)
    ? sqlitePath
    : path.resolve(__dirname, "..", "..", sqlitePath)
  : undefined;

export const getDemoSqlitePath = (): string => {
  if (!resolvedPath) {
    throw new Error("SQLITE_PATH is not defined in demo/.env.demo");
  }
  return resolvedPath;
};
