#!/usr/bin/env node
import path from "node:path";
import {
  collectWorkspaceDependencyNames,
  ensureDir,
  getWorkspacePackages,
  topoSortWorkspaceDependencies,
  writeJson,
} from "./publish-workspace-utils.mjs";

function parseArgs(argv) {
  const options = {
    outputDir: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output-dir") {
      options.outputDir = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return options;
}

function isPublishCandidate(workspaceRoot, pkg) {
  return (
    !pkg.private
    && pkg.dir.startsWith(path.join(workspaceRoot, "packages"))
    && !pkg.dir.includes(`${path.sep}templates${path.sep}`)
  );
}

function main() {
  const workspaceRoot = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  if (!options.outputDir) {
    throw new Error("[publish-proof-plan] --output-dir is required.");
  }

  const outputDir = path.isAbsolute(options.outputDir)
    ? options.outputDir
    : path.resolve(workspaceRoot, options.outputDir);
  ensureDir(outputDir);

  const workspacePackages = getWorkspacePackages(workspaceRoot);
  const workspaceNames = new Set(workspacePackages.keys());
  const publishCandidates = Array.from(workspacePackages.values())
    .filter((pkg) => isPublishCandidate(workspaceRoot, pkg))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((pkg) => ({
      name: pkg.name,
      version: pkg.version,
      dir: pkg.dir,
      changelogPath: pkg.changelogPath,
      workspaceDependencies: collectWorkspaceDependencyNames(pkg, workspaceNames),
    }));

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

  const reportPath = path.join(outputDir, "publish-plan.json");
  writeJson(reportPath, {
    schemaVersion: 1,
    kind: "publish-readiness-plan",
    checkedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    npmRegistry: "https://registry.npmjs.org",
    shouldPublish: publishCandidates.length > 0,
    blockers: [],
    notices: [
      {
        classification: "quality-issue",
        code: "proof-mode-plan",
        message: "Proof mode plan for hosted publish-candidate artifact verification.",
      },
    ],
    pendingChangesets: [],
    publishCandidates,
    buildOrder,
  });

  console.log(`[publish-proof-plan] wrote ${reportPath}`);
  console.log(`[publish-proof-plan] publish candidates: ${publishCandidates.length}`);
}

main();
