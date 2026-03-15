#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  PUBLISH_CONTRACT_SCHEMA_VERSION,
  PUBLISH_CONTRACT_PATHS,
  loadValidatedBuildReportContract,
  loadValidatedPublishManifestContract,
  loadValidatedPublishPlanContract,
  resolveContractFileFromArtifactRoot,
  writeJson,
} from "./publish-workspace-utils.mjs";

function parseArgs(argv) {
  const options = {
    contract: null,
    artifactRoot: null,
    output: null,
    githubOutputPath: null,
    label: "publish-contract",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--contract") {
      options.contract = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--artifact-root") {
      options.artifactRoot = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--output") {
      options.output = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--github-output") {
      options.githubOutputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--label") {
      options.label = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return options;
}

function appendGitHubOutputs(filePath, outputs) {
  if (!filePath) {
    return;
  }

  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function verifyReadinessContract(artifactRoot) {
  const resolvedPath = resolveContractFileFromArtifactRoot(
    artifactRoot,
    PUBLISH_CONTRACT_PATHS.readiness.planFileName,
    "publish-readiness",
  );
  const plan = loadValidatedPublishPlanContract(resolvedPath);
  return {
    contractPath: resolvedPath,
    summary: {
      shouldPublish: plan.shouldPublish,
      blockerCount: plan.blockers.length,
      publishCandidateCount: plan.publishCandidates.length,
    },
    githubOutputs: {
      publish_plan_path: resolvedPath,
    },
  };
}

function verifyArtifactsContract(artifactRoot) {
  const manifestPath = resolveContractFileFromArtifactRoot(
    artifactRoot,
    PUBLISH_CONTRACT_PATHS.artifacts.manifestFileName,
    "publish-artifacts",
  );
  const buildReportPath = resolveContractFileFromArtifactRoot(
    artifactRoot,
    PUBLISH_CONTRACT_PATHS.artifacts.buildReportFileName,
    "publish-artifacts",
  );
  const manifest = loadValidatedPublishManifestContract(manifestPath);
  const buildReport = loadValidatedBuildReportContract(buildReportPath);

  return {
    contractPath: manifestPath,
    summary: {
      packageCount: manifest.packages.length,
      blockerCount: buildReport.blockers.length,
    },
    githubOutputs: {
      publish_manifest_path: manifestPath,
      build_report_path: buildReportPath,
    },
  };
}

function main() {
  const workspaceRoot = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  if (!options.contract || !options.artifactRoot) {
    throw new Error("[publish-contract] --contract and --artifact-root are required.");
  }

  const resolvedArtifactRoot = path.resolve(workspaceRoot, options.artifactRoot);
  const verification = options.contract === "readiness"
    ? verifyReadinessContract(resolvedArtifactRoot)
    : options.contract === "artifacts"
      ? verifyArtifactsContract(resolvedArtifactRoot)
      : null;

  if (!verification) {
    throw new Error(`[publish-contract] Unsupported contract type: ${options.contract}`);
  }

  const report = {
    schemaVersion: PUBLISH_CONTRACT_SCHEMA_VERSION,
    kind: "publish-contract-verification",
    checkedAt: new Date().toISOString(),
    label: options.label,
    contract: options.contract,
    artifactRoot: resolvedArtifactRoot,
    resolvedPath: verification.contractPath,
    ok: true,
    summary: verification.summary,
  };

  if (options.output) {
    writeJson(path.resolve(workspaceRoot, options.output), report);
  }

  appendGitHubOutputs(options.githubOutputPath, verification.githubOutputs);
  console.log(`[publish-contract] verified ${options.contract} contract at ${verification.contractPath}`);
}

main();
