import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(workspaceRoot, "packages", "ddl-docs-cli", "dist", "src", "index.js");
const tempConceptSiteDir = path.join(workspaceRoot, "tmp", "transfer-concept-site");
const transferDdlDir = path.join(workspaceRoot, "packages", "transfer", "db", "ddl");
const transferReviewChangedFilesPath = path.join(workspaceRoot, "tmp", "transfer-review-report-changed-files.txt");
const transferReviewPlanPath = path.join(workspaceRoot, "tmp", "transfer-review-plan.json");
const defaultAiReviewPath = path.join(workspaceRoot, "packages", "transfer", "docs", "review", "ai-review.json");
const structuredConceptRelationshipPath = path.join(workspaceRoot, "tmp", "concept-relationship.json");
const structuredConceptReverseRelationshipPath = path.join(workspaceRoot, "tmp", "concept-reverse-relationships.json");
const structuredConceptAiContextPath = path.join(workspaceRoot, "tmp", "ai-context", "concepts.json");
const structuredConceptReviewSummaryPath = path.join(workspaceRoot, "tmp", "structured-concept-review-summary.json");

const generatedSiteDirs = ["dfd", "processes", "roles"];

function parseArgs(args) {
  const options = {
    includeAiReview: fs.existsSync(defaultAiReviewPath),
    aiReviewPath: defaultAiReviewPath,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--include-ai-review") {
      options.includeAiReview = true;
      continue;
    }
    if (arg === "--exclude-ai-review") {
      options.includeAiReview = false;
      continue;
    }
    if (arg === "--ai-review") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--ai-review requires a JSON file path.");
      }
      options.includeAiReview = true;
      options.aiReviewPath = path.resolve(workspaceRoot, value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown generate-transfer-docs option: ${arg}`);
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));

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

function runCapture(args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: workspaceRoot,
    encoding: "utf8",
    shell: false,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  if (result.status !== 0) {
    throw new Error(`ddl-docs ${args[0]} failed with exit code ${result.status ?? "unknown"}\n${output}`);
  }
  return output;
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

function copyScopeDoc() {
  const sourcePath = path.join(workspaceRoot, "packages", "transfer", "docs", "scope", "SYSTEM_SCOPE.md");
  const targetDir = path.join(workspaceRoot, "docs", "scope");
  const targetPath = path.join(targetDir, "index.md");
  removeDir(targetDir);
  fs.mkdirSync(assertInsideWorkspace(targetDir), { recursive: true });
  const body = fs.readFileSync(assertInsideWorkspace(sourcePath), "utf8");
  fs.writeFileSync(
    assertInsideWorkspace(targetPath),
    [
      "<!-- generated-by: transfer-docs -->",
      "",
      body.trimEnd(),
      "",
      "## Source",
      "",
      "- `packages/transfer/docs/scope/SYSTEM_SCOPE.md`",
      "- `packages/transfer/docs/scope/scope-rules.json`",
      "",
    ].join("\n"),
    "utf8"
  );
}

function copyTestingDoc() {
  const sourcePath = path.join(workspaceRoot, "packages", "transfer", "docs", "testing", "TEST_POLICY.md");
  const targetDir = path.join(workspaceRoot, "docs", "testing");
  const targetPath = path.join(targetDir, "index.md");
  removeDir(targetDir);
  fs.mkdirSync(assertInsideWorkspace(targetDir), { recursive: true });
  const body = fs.readFileSync(assertInsideWorkspace(sourcePath), "utf8");
  fs.writeFileSync(
    assertInsideWorkspace(targetPath),
    [
      "<!-- generated-by: transfer-docs -->",
      "",
      body.trimEnd(),
      "",
      "## Source",
      "",
      "- `packages/transfer/docs/testing/TEST_POLICY.md`",
      "- `packages/transfer/docs/testing/test-rules.json`",
      "",
    ].join("\n"),
    "utf8"
  );
}

function copyAuthorityDoc() {
  const sourcePath = path.join(workspaceRoot, "packages", "transfer", "docs", "review", "AUTHORITY_MODEL.md");
  const targetDir = path.join(workspaceRoot, "docs", "authority");
  const targetPath = path.join(targetDir, "index.md");
  removeDir(targetDir);
  fs.mkdirSync(assertInsideWorkspace(targetDir), { recursive: true });
  const body = fs.readFileSync(assertInsideWorkspace(sourcePath), "utf8");
  fs.writeFileSync(
    assertInsideWorkspace(targetPath),
    [
      "<!-- generated-by: transfer-docs -->",
      "",
      body.trimEnd(),
      "",
      "## Source",
      "",
      "- `packages/transfer/docs/review/AUTHORITY_MODEL.md`",
      "- `packages/transfer/docs/review/authority-rules.json`",
      "",
    ].join("\n"),
    "utf8"
  );
}

function copyTechnologyDoc() {
  const sourcePath = path.join(workspaceRoot, "packages", "transfer", "docs", "technology", "TECHNOLOGY_POLICY.md");
  const targetDir = path.join(workspaceRoot, "docs", "technology");
  const targetPath = path.join(targetDir, "index.md");
  removeDir(targetDir);
  fs.mkdirSync(assertInsideWorkspace(targetDir), { recursive: true });
  const body = fs.readFileSync(assertInsideWorkspace(sourcePath), "utf8");
  fs.writeFileSync(
    assertInsideWorkspace(targetPath),
    [
      "<!-- generated-by: transfer-docs -->",
      "",
      body.trimEnd(),
      "",
      "## Source",
      "",
      "- `packages/transfer/docs/technology/TECHNOLOGY_POLICY.md`",
      "- `packages/transfer/docs/technology/tech-rules.json`",
      "",
    ].join("\n"),
    "utf8"
  );
}

function buildStructuredConceptPoc() {
  run([
    "structured-concept",
    "build",
    "--concept-dir",
    "packages/transfer/docs/concepts",
    "--concept-relationship",
    "packages/transfer/docs/concepts/concept-relationship.json",
    "--out-dir",
    "docs/concepts",
    "--relationship-out",
    path.relative(workspaceRoot, structuredConceptRelationshipPath),
    "--reverse-relationship-out",
    path.relative(workspaceRoot, structuredConceptReverseRelationshipPath),
    "--ai-context-out",
    path.relative(workspaceRoot, structuredConceptAiContextPath),
    "--review-summary-out",
    path.relative(workspaceRoot, structuredConceptReviewSummaryPath),
  ]);
}

function collectFilesRecursive(rootPath, extensions) {
  const resolvedRoot = assertInsideWorkspace(rootPath);
  if (!fs.existsSync(resolvedRoot)) {
    return [];
  }
  const entries = fs.readdirSync(resolvedRoot, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(resolvedRoot, entry.name);
    if (entry.isDirectory()) {
      return collectFilesRecursive(entryPath, extensions);
    }
    if (!entry.isFile() || !extensions.includes(path.extname(entry.name))) {
      return [];
    }
    if (entry.name === "README.md") {
      return [];
    }
    return [path.relative(workspaceRoot, entryPath).replace(/\\/g, "/")];
  }).sort();
}

function getTransferReviewSourcePaths() {
  const orderPath = path.join(transferDdlDir, "order.json");
  const order = JSON.parse(fs.readFileSync(orderPath, "utf8"));
  const ddlFiles = Array.isArray(order.order)
    ? order.order.map((fileName) => path.join("packages", "transfer", "db", "ddl", fileName).replace(/\\/g, "/"))
    : [];
  return Array.from(new Set([
    ...ddlFiles,
    "packages/transfer/db/ddl/order.json",
    "packages/transfer/db/ddl/relationship.json",
    "packages/transfer/db/ddl/table-docs.json",
    "packages/transfer/docs/scope/SYSTEM_SCOPE.md",
    "packages/transfer/docs/scope/scope-rules.json",
    "packages/transfer/docs/testing/TEST_POLICY.md",
    "packages/transfer/docs/testing/test-rules.json",
    "packages/transfer/docs/review/AUTHORITY_MODEL.md",
    "packages/transfer/docs/review/authority-rules.json",
    "packages/transfer/docs/technology/TECHNOLOGY_POLICY.md",
    "packages/transfer/docs/technology/tech-rules.json",
    "packages/transfer/docs/concepts/concept-relationship.json",
    ...collectFilesRecursive(path.join(workspaceRoot, "packages", "transfer", "docs", "concepts"), [".md"]),
    "packages/transfer/docs/dfd/relationship.json",
    ...collectFilesRecursive(path.join(workspaceRoot, "packages", "transfer", "docs", "dfd"), [".md"]),
    ...collectFilesRecursive(path.join(workspaceRoot, "packages", "transfer", "docs", "processes"), [".md", ".json"]),
  ])).sort();
}

function runTransferMetadataCheck() {
  const output = runCapture([
    "check",
    "--ddl-dir",
    "packages/transfer/db/ddl",
    "--table-docs",
    "packages/transfer/db/ddl/table-docs.json",
    "--relationship",
    "packages/transfer/db/ddl/relationship.json",
    "--order",
    "packages/transfer/db/ddl/order.json",
    "--concept-relationship",
    "packages/transfer/docs/concepts/concept-relationship.json",
    "--dfd-relationship",
    "packages/transfer/docs/dfd/relationship.json",
    "--scope-rules",
    "packages/transfer/docs/scope/scope-rules.json",
    "--test-rules",
    "packages/transfer/docs/testing/test-rules.json",
    "--authority-rules",
    "packages/transfer/docs/review/authority-rules.json",
    "--technology-rules",
    "packages/transfer/docs/technology/tech-rules.json",
    "--process-dir",
    "packages/transfer/docs/processes",
    "--default-schema",
    "rawsql_transfer",
  ]);
  const summary = output.match(/DDL docs metadata check: (\d+) error\(s\), (\d+) warning\(s\)\./);
  const result = {
    errors: summary ? Number(summary[1]) : 0,
    warnings: summary ? Number(summary[2]) : 0,
    output,
  };
  if (result.warnings > 0) {
    throw new Error(`transfer metadata check produced warning(s), which block generated review report readiness.\n${output}`);
  }
  return result;
}

function runTransferReviewPlan() {
  const changedFiles = getTransferReviewSourcePaths();
  fs.mkdirSync(assertInsideWorkspace(path.dirname(transferReviewChangedFilesPath)), { recursive: true });
  fs.writeFileSync(assertInsideWorkspace(transferReviewChangedFilesPath), `${changedFiles.join("\n")}\n`, "utf8");
  run([
    "review-plan",
    "--changed-files",
    path.relative(workspaceRoot, transferReviewChangedFilesPath),
    "--ddl-dir",
    "packages/transfer/db/ddl",
    "--relationship",
    "packages/transfer/db/ddl/relationship.json",
    "--table-docs",
    "packages/transfer/db/ddl/table-docs.json",
    "--concept-relationship",
    "packages/transfer/docs/concepts/concept-relationship.json",
    "--dfd-relationship",
    "packages/transfer/docs/dfd/relationship.json",
    "--process-dir",
    "packages/transfer/docs/processes",
    "--scope-rules",
    "packages/transfer/docs/scope/scope-rules.json",
    "--scope-doc",
    "packages/transfer/docs/scope/SYSTEM_SCOPE.md",
    "--test-rules",
    "packages/transfer/docs/testing/test-rules.json",
    "--test-policy",
    "packages/transfer/docs/testing/TEST_POLICY.md",
    "--authority-rules",
    "packages/transfer/docs/review/authority-rules.json",
    "--authority-model",
    "packages/transfer/docs/review/AUTHORITY_MODEL.md",
    "--technology-rules",
    "packages/transfer/docs/technology/tech-rules.json",
    "--technology-policy",
    "packages/transfer/docs/technology/TECHNOLOGY_POLICY.md",
    "--package",
    "@rawsql-ts/transfer",
    "--out",
    path.relative(workspaceRoot, transferReviewPlanPath),
  ]);
  return JSON.parse(fs.readFileSync(assertInsideWorkspace(transferReviewPlanPath), "utf8"));
}

function assertTransferReviewPlanClean(reviewPlan) {
  const diagnostics = reviewPlan.changedFiles.flatMap((entry) => entry.diagnostics ?? []);
  if (reviewPlan.unmappedArtifacts.length === 0 && diagnostics.length === 0) {
    return;
  }
  const lines = [
    "transfer review-plan produced blocking diagnostics.",
    `Unmapped business artifacts: ${reviewPlan.unmappedArtifacts.length}`,
    `Diagnostics: ${diagnostics.length}`,
    "",
    ...reviewPlan.unmappedArtifacts.map((artifact) => `unmapped: ${artifact.path}`),
    ...diagnostics.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`),
  ];
  throw new Error(lines.join("\n"));
}

function formatIdList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "None";
  }
  return items.map((item) => `\`${item.id}\``).join(", ");
}

function formatCount(value) {
  return Number.isFinite(value) ? String(value) : "0";
}

function formatMarkdownInline(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }
  return value.replace(/\r?\n/g, " ").trim();
}

function formatMarkdownBlock(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }
  return value.trim();
}

function formatEvidence(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return ["- None"];
  }
  return evidence.map((item) => {
    if (typeof item === "string") {
      return `- ${item}`;
    }
    if (!item || typeof item !== "object") {
      return "- Unknown evidence";
    }
    const target = typeof item.path === "string"
      ? `${item.path}${Number.isInteger(item.line) ? `:${item.line}` : ""}`
      : undefined;
    const note = formatMarkdownInline(item.note ?? item.reason ?? item.summary);
    if (target && note) {
      return `- \`${target}\` - ${note}`;
    }
    if (target) {
      return `- \`${target}\``;
    }
    return `- ${note || "Unknown evidence"}`;
  });
}

function readAiReview(aiReviewPath) {
  const resolvedPath = assertInsideWorkspace(aiReviewPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`AI review JSON was requested but not found: ${path.relative(workspaceRoot, resolvedPath)}`);
  }
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`AI review JSON must be an object: ${path.relative(workspaceRoot, resolvedPath)}`);
  }
  if (!Array.isArray(parsed.findings)) {
    throw new Error(`AI review JSON must contain a findings array: ${path.relative(workspaceRoot, resolvedPath)}`);
  }
  return {
    path: path.relative(workspaceRoot, resolvedPath).replace(/\\/g, "/"),
    review: parsed,
  };
}

function renderAiReviewSummary(aiReviewArtifact) {
  if (!aiReviewArtifact) {
    return [
      "## AI Semantic Review",
      "",
      "AI semantic review was not included.",
      "",
      "The CLI does not generate, refresh, infer, translate, or mutate AI review JSON.",
      "",
    ].join("\n");
  }

  const { path: sourcePath, review } = aiReviewArtifact;
  const language = review.metadataLanguagePolicy?.humanFacingLanguage
    ?? review.humanFacingLanguage
    ?? "unspecified";
  const counts = review.findings.reduce((acc, finding) => {
    const status = typeof finding?.status === "string" ? finding.status : "unspecified";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const openFindings = review.findings.filter((finding) => finding?.status === "open");
  const nonOpenFindings = review.findings.filter((finding) => finding?.status !== "open");
  const findingSections = [...openFindings, ...nonOpenFindings].flatMap((finding) => {
    const id = formatMarkdownInline(finding?.id) || "unnamed-finding";
    const title = formatMarkdownInline(finding?.title) || id;
    const summary = formatMarkdownBlock(finding?.summary ?? finding?.description);
    const recommendation = formatMarkdownBlock(finding?.recommendation);
    return [
      `### ${id}`,
      "",
      `- Status: \`${formatMarkdownInline(finding?.status) || "unspecified"}\``,
      `- Severity: \`${formatMarkdownInline(finding?.severity) || "unspecified"}\``,
      `- Category: \`${formatMarkdownInline(finding?.category) || "unspecified"}\``,
      "",
      `**${title}**`,
      "",
      ...(summary ? [summary, ""] : []),
      "Evidence:",
      "",
      ...formatEvidence(finding?.evidence),
      "",
      ...(recommendation ? ["Recommendation:", "", recommendation, ""] : []),
    ];
  });

  return [
    "## AI Semantic Review",
    "",
    `Source: \`${sourcePath}\``,
    `Human-facing language: \`${language}\``,
    `Status: \`${formatMarkdownInline(review.status) || "unspecified"}\``,
    `Total findings: ${review.findings.length}`,
    `Open findings: ${formatCount(counts.open)}`,
    `Resolved findings: ${formatCount(counts.resolved)}`,
    `Accepted findings: ${formatCount(counts.accepted)}`,
    "",
    "This section displays an existing AI review JSON artifact.",
    "The CLI does not generate, refresh, infer, translate, or mutate this JSON.",
    "",
    ...(findingSections.length === 0 ? ["- No findings.", ""] : findingSections),
  ].join("\n");
}

function renderReviewHarnessSummary(metadataCheck, reviewPlan) {
  const diagnostics = reviewPlan.changedFiles.flatMap((entry) => entry.diagnostics ?? []);
  return [
    "## Review Harness Summary",
    "",
    "This section aggregates the package-level review harness inputs used before semantic review.",
    "",
    "- Metadata check errors: " + metadataCheck.errors,
    "- Metadata check warnings: " + metadataCheck.warnings,
    "- Review-plan source artifacts: " + reviewPlan.changedFiles.length,
    "- Unmapped business artifacts: " + reviewPlan.unmappedArtifacts.length,
    "- Review-plan diagnostics: " + diagnostics.length,
    "- Mandatory scope rules: " + formatIdList(reviewPlan.mandatoryScope?.rules),
    "- Mandatory verification policies: " + formatIdList(reviewPlan.mandatoryVerification?.policies),
    "- Mandatory authority rules: " + formatIdList(reviewPlan.mandatoryAuthority?.rules),
    "- Mandatory technology rules: " + formatIdList(reviewPlan.mandatoryTechnology?.rules),
    "",
    "### Review-plan Diagnostics",
    "",
    ...(diagnostics.length === 0
      ? ["- None"]
      : diagnostics.map((diagnostic) => `- ${diagnostic.severity}: ${diagnostic.message}`)),
    "",
    "### Unmapped Business Artifacts",
    "",
    ...(reviewPlan.unmappedArtifacts.length === 0
      ? ["- None"]
      : reviewPlan.unmappedArtifacts.map((artifact) => `- \`${artifact.path}\``)),
    "",
    "### Source Inputs",
    "",
    "- Package scope: `packages/transfer/docs/scope/SYSTEM_SCOPE.md`",
    "- Scope rules: `packages/transfer/docs/scope/scope-rules.json`",
    "- Test policy: `packages/transfer/docs/testing/TEST_POLICY.md`",
    "- Test rules: `packages/transfer/docs/testing/test-rules.json`",
    "- Authority model: `packages/transfer/docs/review/AUTHORITY_MODEL.md`",
    "- Authority rules: `packages/transfer/docs/review/authority-rules.json`",
    "- Technology policy: `packages/transfer/docs/technology/TECHNOLOGY_POLICY.md`",
    "- Technology rules: `packages/transfer/docs/technology/tech-rules.json`",
    "- Review plan snapshot: `tmp/transfer-review-plan.json`",
    "",
  ].join("\n");
}

function writeProductReviewReport(metadataCheck, reviewPlan, aiReviewArtifact) {
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
    "- [Review Harness Summary](#review-harness-summary)",
    "- [AI Semantic Review](#ai-semantic-review)",
    "- [Table Definitions](./rawsql-transfer/)",
    "- [Column Index](./rawsql-transfer/columns/)",
    "",
    "## DDL / Column Mechanical Review",
    "",
    ddlReviewBody.trimEnd() || "- No DDL review report was generated.",
    "",
    renderReviewHarnessSummary(metadataCheck, reviewPlan).trimEnd(),
    "",
    renderAiReviewSummary(aiReviewArtifact).trimEnd(),
    "",
  ].join("\n");

  fs.writeFileSync(assertInsideWorkspace(productReviewPath), productReview, "utf8");

  if (fs.existsSync(ddlIndexPath)) {
    const ddlIndex = fs.readFileSync(ddlIndexPath, "utf8");
    const newDdlIndex = ddlIndex.replace(/^- \[Review Report\]\(\.\/review\.md\)\r?\n/m, "");
    if (newDdlIndex === ddlIndex) {
      throw new Error(`Expected to remove upstream review link from ${ddlIndexPath}, but no matching link was found.`);
    }
    fs.writeFileSync(ddlIndexPath, newDdlIndex, "utf8");
  }

  if (fs.existsSync(ddlColumnIndexPath)) {
    const ddlColumnIndex = fs.readFileSync(ddlColumnIndexPath, "utf8");
    const newDdlColumnIndex = ddlColumnIndex.replace(
      /\[Review Report\]\(\.\.\/review\.md\)/g,
      "[Review Report](../../review.md)"
    );
    if (newDdlColumnIndex === ddlColumnIndex) {
      throw new Error(
        `Expected to retarget upstream review links from ${ddlColumnIndexPath}, but no matching links were found.`
      );
    }
    fs.writeFileSync(ddlColumnIndexPath, newDdlColumnIndex, "utf8");
  }

  if (fs.existsSync(ddlReviewPath)) {
    fs.rmSync(assertInsideWorkspace(ddlReviewPath), { force: true });
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
removeDir(path.join(workspaceRoot, "docs", "concepts"));
buildStructuredConceptPoc();
copyScopeDoc();
copyTestingDoc();
copyAuthorityDoc();
copyTechnologyDoc();

const metadataCheck = runTransferMetadataCheck();
const reviewPlan = runTransferReviewPlan();
assertTransferReviewPlanClean(reviewPlan);
const aiReviewArtifact = options.includeAiReview ? readAiReview(options.aiReviewPath) : null;

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

writeProductReviewReport(metadataCheck, reviewPlan, aiReviewArtifact);

console.log("[transfer-docs] generated Concept/DFD/Process and DDL review pages.");
