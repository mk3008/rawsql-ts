const { readdirSync, existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

const ddlDir = "ddl";

let cliEntry;
try {
  cliEntry = require.resolve("@rawsql-ts/ddl-docs-cli");
} catch {
  console.error("@rawsql-ts/ddl-docs-cli is not installed. Run: npm install");
  process.exit(1);
}

const hasSqlInputs =
  existsSync(ddlDir) &&
  readdirSync(ddlDir, { recursive: true }).some(
    (entry) => typeof entry === "string" && entry.endsWith(".sql"),
  );

if (!hasSqlInputs) {
  console.log("No SQL files found in ddl/. Skipping ddl-docs generation.");
  process.exit(0);
}

const args = [
  cliEntry,
  "generate",
  "--ddl-dir",
  "ddl",
  "--out-dir",
  "docs/tables",
  "--label-separator",
  " :",
  // Accept pg_dump output directly by filtering admin-only statements first.
  "--filter-pg-dump",
];

const result = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
