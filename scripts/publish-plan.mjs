#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  NPM_PUBLIC_REGISTRY,
  collectWorkspaceDependencyNames,
  ensureDir,
  getReadinessContractDir,
  getReadinessPlanPath,
  getWorkspacePackages,
  listPendingChangesetFiles,
  npmPackageExists,
  npmPackageVersionExists,
  topoSortWorkspaceDependencies,
  writeJson,
} from "./publish-workspace-utils.mjs";

function parseArgs(argv) {
  const options = {
    githubOutputPath: null,
    outputDir: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--github-output") {
      options.githubOutputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--output-dir") {
      options.outputDir = argv[index + 1] ?? null;
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
  fs.appendFileSync(filePath, `${lines.join(os.EOL)}${os.EOL}`, "utf8");
}

function main() {
  const workspaceRoot = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const outputDir = options.outputDir
    ? path.resolve(workspaceRoot, options.outputDir)
    : getReadinessContractDir(workspaceRoot);
  ensureDir(outputDir);

  const workspacePackages = getWorkspacePackages(workspaceRoot);
  const workspaceNames = new Set(workspacePackages.keys());
  const pendingChangesets = listPendingChangesetFiles(workspaceRoot);
  const blockers = [];
  const notices = [];
  const publishCandidates = [];

  if (pendingChangesets.length > 0) {
    blockers.push({
      classification: "publish-blocker",
      code: "pending-changesets",
      message: "Unapplied changesets exist. Merge the release PR before running manual publish.",
      details: pendingChangesets,
    });
  }

  for (const pkg of Array.from(workspacePackages.values()).sort((left, right) => left.name.localeCompare(right.name))) {
    if (pkg.private) {
      continue;
    }

    const existsOnRegistry = npmPackageExists(pkg.name);
    if (!existsOnRegistry) {
      notices.push({
        classification: "quality-issue",
        code: "unregistered-package",
        message: `${pkg.name} is not registered on npm and will be skipped by manual publish.`,
        packageName: pkg.name,
        version: pkg.version,
      });
      continue;
    }

    const alreadyPublished = npmPackageVersionExists(pkg.name, pkg.version);
    if (alreadyPublished) {
      continue;
    }

    publishCandidates.push({
      name: pkg.name,
      version: pkg.version,
      dir: pkg.dir,
      changelogPath: pkg.changelogPath,
      workspaceDependencies: collectWorkspaceDependencyNames(pkg, workspaceNames),
    });
  }

  const buildOrder = topoSortWorkspaceDependencies(
    workspacePackages,
    publishCandidates.map((pkg) => pkg.name),
  ).map((packageName) => {
    const pkg = workspacePackages.get(packageName);
    return {
      name: packageName,
      dir: pkg.dir,
      isPublishCandidate: publishCandidates.some((candidate) => candidate.name === packageName),
      hasBuildScript: typeof pkg.scripts.build === "string",
    };
  });

  const shouldPublish = blockers.length === 0 && publishCandidates.length > 0;
  if (publishCandidates.length === 0 && blockers.length === 0) {
    notices.push({
      classification: "quality-issue",
      code: "no-unpublished-packages",
      message: "No unpublished package versions were found on npm.",
    });
  }

  const report = {
    schemaVersion: 1,
    kind: "publish-readiness-plan",
    checkedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    npmRegistry: NPM_PUBLIC_REGISTRY,
    shouldPublish,
    blockers,
    notices,
    pendingChangesets,
    publishCandidates,
    buildOrder,
  };

  const reportPath = getReadinessPlanPath(outputDir);
  writeJson(reportPath, report);

  console.log(`[publish-plan] wrote ${reportPath}`);
  console.log(`[publish-plan] publish candidates: ${publishCandidates.length}`);
  console.log(`[publish-plan] blockers: ${blockers.length}`);
  console.log(`[publish-plan] notices: ${notices.length}`);

  appendGitHubOutputs(options.githubOutputPath, {
    should_publish: shouldPublish ? "true" : "false",
    publish_plan_path: reportPath,
    publish_candidate_count: String(publishCandidates.length),
  });
}

main();
