import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(workspaceRoot, "packages", "ddl-docs-cli", "dist", "src", "index.js");
const tempConceptSiteDir = path.join(workspaceRoot, "tmp", "transfer-concept-site");
const transferDdlDir = path.join(workspaceRoot, "packages", "transfer", "db", "ddl");

const generatedSiteDirs = ["concepts", "dfd", "processes", "roles"];

function run(args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`ddl-docs ${args[0]} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function assertInsideWorkspace(targetPath) {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside workspace: ${resolved}`);
  }
  return resolved;
}

function removeDir(targetPath) {
  fs.rmSync(assertInsideWorkspace(targetPath), { recursive: true, force: true });
}

function copyDir(sourcePath, targetPath) {
  const source = assertInsideWorkspace(sourcePath);
  const target = assertInsideWorkspace(targetPath);
  removeDir(target);
  fs.cpSync(source, target, { recursive: true });
}

function getOrderedTransferDdlArgs() {
  const orderPath = path.join(transferDdlDir, "order.json");
  const order = JSON.parse(fs.readFileSync(orderPath, "utf8"));
  if (!Array.isArray(order.order)) {
    throw new Error("packages/transfer/db/ddl/order.json must contain an order array.");
  }
  return order.order.flatMap((fileName) => [
    "--ddl-file",
    path.join("packages", "transfer", "db", "ddl", fileName),
  ]);
}

removeDir(tempConceptSiteDir);
run([
  "concept-site",
  "--concept-relationship",
  "packages/transfer/docs/concepts/concept-relationship.json",
  "--dfd-relationship",
  "packages/transfer/docs/dfd/relationship.json",
  "--out-dir",
  path.relative(workspaceRoot, tempConceptSiteDir),
]);

for (const dir of generatedSiteDirs) {
  copyDir(path.join(tempConceptSiteDir, dir), path.join(workspaceRoot, "docs", dir));
}

removeDir(path.join(workspaceRoot, "docs", "rawsql-transfer"));
run([
  "generate",
  ...getOrderedTransferDdlArgs(),
  "--out-dir",
  "docs/rawsql-transfer",
  "--table-docs",
  "packages/transfer/db/ddl/table-docs.json",
  "--relationship",
  "packages/transfer/db/ddl/relationship.json",
  "--concept-relationship",
  "packages/transfer/docs/concepts/concept-relationship.json",
  "--default-schema",
  "rawsql_transfer",
]);

console.log("[transfer-docs] generated Concept/DFD/Process and DDL review pages.");
