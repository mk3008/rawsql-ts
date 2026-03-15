#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  PNPM,
  ensureCleanDir,
  ensureDir,
  findPackedTarball,
  getArtifactsContractDir,
  getBuildReportPath,
  getPublishManifestPath,
  getReadinessContractDir,
  getReadinessPlanPath,
  loadValidatedPublishPlanContract,
  toRelocatableTarballLocator,
  run,
  writeJson,
} from "./publish-workspace-utils.mjs";

function parseArgs(argv) {
  const options = {
    planPath: null,
    outputDir: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") {
      options.planPath = argv[index + 1] ?? null;
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

function toPackDirName(packageName) {
  return packageName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function loadPlan(workspaceRoot, planPath) {
  const resolvedPlanPath = planPath
    ? (path.isAbsolute(planPath) ? planPath : path.resolve(workspaceRoot, planPath))
    : getReadinessPlanPath(getReadinessContractDir(workspaceRoot));

  return {
    planPath: resolvedPlanPath,
    plan: loadValidatedPublishPlanContract(resolvedPlanPath),
  };
}

function main() {
  const workspaceRoot = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const { planPath, plan } = loadPlan(workspaceRoot, options.planPath);
  const outputDir = options.outputDir
    ? (path.isAbsolute(options.outputDir) ? options.outputDir : path.resolve(workspaceRoot, options.outputDir))
    : getArtifactsContractDir(workspaceRoot);
  const tarballRoot = path.join(outputDir, "tarballs");
  const manifestPath = getPublishManifestPath(outputDir);
  const reportPath = getBuildReportPath(outputDir);
  const candidateNames = new Set(plan.publishCandidates.map((pkg) => pkg.name));
  const report = {
    schemaVersion: 1,
    kind: "publish-artifact-build-report",
    checkedAt: new Date().toISOString(),
    planPath,
    blockers: [],
    builtDependencies: [],
    packedArtifacts: [],
  };

  ensureCleanDir(outputDir);
  ensureDir(tarballRoot);

  if (!plan.shouldPublish) {
    writeJson(reportPath, report);
    console.log("[publish-artifacts] publish plan says there is nothing to publish.");
    return;
  }

  try {
    for (const entry of plan.buildOrder) {
      if (candidateNames.has(entry.name) || !entry.hasBuildScript) {
        continue;
      }

      // Build workspace prerequisites first so candidate packs do not rely on accidental dist state.
      run(PNPM, ["run", "build"], { cwd: entry.dir });
      if (!fs.existsSync(path.join(entry.dir, "dist"))) {
        throw new Error(`[publish-artifacts] ${entry.name} build completed without producing dist/.`);
      }
      report.builtDependencies.push({
        name: entry.name,
        dir: entry.dir,
      });
    }

    for (const candidate of plan.publishCandidates) {
      const packDir = path.join(tarballRoot, toPackDirName(candidate.name));
      ensureCleanDir(packDir);

      // Let each package's prepack build its own publish artifact, then persist the tarball for the publish job.
      run(PNPM, ["pack", "--pack-destination", packDir], { cwd: candidate.dir });
      const tarballPath = findPackedTarball(packDir);
      report.packedArtifacts.push({
        ...candidate,
        tarballPath: toRelocatableTarballLocator(outputDir, tarballPath),
      });
    }
  } catch (error) {
    report.blockers.push({
      classification: "publish-blocker",
      code: "artifact-build-failed",
      message: error instanceof Error ? error.message : String(error),
    });
    writeJson(reportPath, report);
    throw error;
  }

  const manifest = {
    schemaVersion: 1,
    kind: "publish-artifact-manifest",
    checkedAt: new Date().toISOString(),
    planPath,
    packages: report.packedArtifacts,
  };

  writeJson(manifestPath, manifest);
  writeJson(reportPath, report);
  console.log(`[publish-artifacts] wrote ${manifestPath}`);
}

main();
