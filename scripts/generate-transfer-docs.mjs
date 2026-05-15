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

function writeProductReviewReport() {
  const ddlReviewPath = path.join(workspaceRoot, "docs", "rawsql-transfer", "review.md");
  const productReviewPath = path.join(workspaceRoot, "docs", "review.md");
  const ddlIndexPath = path.join(workspaceRoot, "docs", "rawsql-transfer", "index.md");
  const ddlColumnIndexPath = path.join(workspaceRoot, "docs", "rawsql-transfer", "columns", "index.md");

  const ddlReview = fs.existsSync(ddlReviewPath) ? fs.readFileSync(ddlReviewPath, "utf8") : "";
  const ddlReviewBody = ddlReview
    .replace(/^<!-- generated-by: @rawsql-ts\/ddl-docs-cli -->\r?\n\r?\n/, "")
    .replace(/^# Review Report\r?\n\r?\n/, "")
    .replace(/^## /gm, "### ");

  const productReview = [
    "<!-- generated-by: transfer-docs -->",
    "",
    "# Transfer Review Report",
    "",
    "This page is the product-level review report for `@rawsql-ts/transfer`.",
    "It collects machine-check review signals first, then leaves semantic Concept / Process / DDL review to human and AI review workflows.",
    "",
    "## Review Sections",
    "",
    "- [DDL / Column Mechanical Review](#ddl-column-mechanical-review)",
    "- [Table Definitions](./rawsql-transfer/)",
    "- [Column Index](./rawsql-transfer/columns/)",
    "",
    "## DDL / Column Mechanical Review",
    "",
    ddlReviewBody.trimEnd() || "- No DDL review report was generated.",
    "",
  ].join("\n");

  fs.writeFileSync(assertInsideWorkspace(productReviewPath), productReview, "utf8");
  if (fs.existsSync(ddlReviewPath)) {
    fs.rmSync(assertInsideWorkspace(ddlReviewPath), { force: true });
  }

  if (fs.existsSync(ddlIndexPath)) {
    const ddlIndex = fs.readFileSync(ddlIndexPath, "utf8");
    fs.writeFileSync(
      ddlIndexPath,
      ddlIndex.replace(/^- \[Review Report\]\(\.\/review\.md\)\r?\n/m, ""),
      "utf8"
    );
  }

  if (fs.existsSync(ddlColumnIndexPath)) {
    const ddlColumnIndex = fs.readFileSync(ddlColumnIndexPath, "utf8");
    fs.writeFileSync(
      ddlColumnIndexPath,
      ddlColumnIndex.replace(/\[Review Report\]\(\.\.\/review\.md\)/g, "[Review Report](../../review.md)"),
      "utf8"
    );
  }
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
  "--dfd-relationship",
  "packages/transfer/docs/dfd/relationship.json",
  "--default-schema",
  "rawsql_transfer",
]);

writeProductReviewReport();

console.log("[transfer-docs] generated Concept/DFD/Process and DDL review pages.");
