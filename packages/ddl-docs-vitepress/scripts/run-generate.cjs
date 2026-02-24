const { readdirSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const ddlDir = resolve("ddl");
const cliEntry = resolve("..", "ddl-docs-cli", "dist", "index.js");

const hasSqlInputs =
  existsSync(ddlDir) &&
  readdirSync(ddlDir, { recursive: true }).some(
    (entry) => typeof entry === "string" && entry.endsWith(".sql"),
  );

if (!hasSqlInputs) {
  console.log("No SQL files found in ddl/. Skipping ddl-docs generation.");
  process.exit(0);
}

if (!existsSync(cliEntry)) {
  console.error(`ddl-docs-cli build artifact was not found: ${cliEntry}`);
  process.exit(1);
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
];

const result = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
