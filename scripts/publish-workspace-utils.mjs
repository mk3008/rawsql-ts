import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const IS_WINDOWS = process.platform === "win32";
export const PNPM = "pnpm";
export const NPM = "npm";
export const NPM_PUBLIC_REGISTRY = "https://registry.npmjs.org";
export const PUBLISH_CONTRACT_SCHEMA_VERSION = 1;
export const PUBLISH_CONTRACT_PATHS = {
  readiness: {
    artifactName: "publish-readiness-contract",
    dirSegments: ["tmp", "publish-contracts", "readiness"],
    planFileName: "publish-plan.json",
  },
  artifacts: {
    artifactName: "publish-artifacts-contract",
    dirSegments: ["tmp", "publish-contracts", "artifacts"],
    manifestFileName: "publish-manifest.json",
    buildReportFileName: "build-report.json",
  },
};

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function ensureCleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function getReadinessContractDir(workspaceRoot) {
  return path.join(workspaceRoot, ...PUBLISH_CONTRACT_PATHS.readiness.dirSegments);
}

export function getReadinessPlanPath(contractDir) {
  return path.join(contractDir, PUBLISH_CONTRACT_PATHS.readiness.planFileName);
}

export function getArtifactsContractDir(workspaceRoot) {
  return path.join(workspaceRoot, ...PUBLISH_CONTRACT_PATHS.artifacts.dirSegments);
}

export function getPublishManifestPath(contractDir) {
  return path.join(contractDir, PUBLISH_CONTRACT_PATHS.artifacts.manifestFileName);
}

export function getBuildReportPath(contractDir) {
  return path.join(contractDir, PUBLISH_CONTRACT_PATHS.artifacts.buildReportFileName);
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: IS_WINDOWS,
    ...options,
  });

  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

export function runWithOutput(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WINDOWS,
    ...options,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    const snippet = combined ? combined.split(/\r?\n/).slice(-60).join("\n") : "";
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with exit code ${result.status}`,
        snippet ? `---\n${snippet}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function publishContractError(contractName, message) {
  return new Error(`[publish-contract] Artifact contract violation (${contractName}): ${message}`);
}

function collectFilesByBasename(rootDir, basename) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const matches = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const nextPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name === basename) {
        matches.push(nextPath);
      }
    }
  }

  return matches.sort();
}

function requireObject(value, contractName, description) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw publishContractError(contractName, `${description} must be an object.`);
  }
}

function requireArray(value, contractName, description) {
  if (!Array.isArray(value)) {
    throw publishContractError(contractName, `${description} must be an array.`);
  }
}

function requireBoolean(value, contractName, description) {
  if (typeof value !== "boolean") {
    throw publishContractError(contractName, `${description} must be a boolean.`);
  }
}

function validateSchemaVersion(payload, contractName) {
  if (payload.schemaVersion !== PUBLISH_CONTRACT_SCHEMA_VERSION) {
    throw publishContractError(
      contractName,
      `schemaVersion must be ${PUBLISH_CONTRACT_SCHEMA_VERSION}, received ${String(payload.schemaVersion)}.`,
    );
  }
}

export function resolveContractFileFromArtifactRoot(artifactRoot, fileName, contractName) {
  const resolvedRoot = path.resolve(artifactRoot);
  const matches = collectFilesByBasename(resolvedRoot, fileName);
  if (matches.length === 0) {
    throw publishContractError(
      contractName,
      `expected ${fileName} under ${resolvedRoot}, but no matching file was found after artifact download.`,
    );
  }
  if (matches.length > 1) {
    throw publishContractError(
      contractName,
      `expected exactly one ${fileName} under ${resolvedRoot}, but found ${matches.length}: ${matches.join(", ")}`,
    );
  }
  return matches[0];
}

export function loadValidatedPublishPlanContract(planPath) {
  if (!fs.existsSync(planPath)) {
    throw publishContractError("publish-readiness", `expected publish plan file at ${planPath}.`);
  }

  const plan = readJson(planPath);
  requireObject(plan, "publish-readiness", "publish plan payload");
  validateSchemaVersion(plan, "publish-readiness");
  if (plan.kind !== "publish-readiness-plan") {
    throw publishContractError("publish-readiness", `kind must be "publish-readiness-plan", received ${String(plan.kind)}.`);
  }
  requireBoolean(plan.shouldPublish, "publish-readiness", "shouldPublish");
  requireArray(plan.blockers, "publish-readiness", "blockers");
  requireArray(plan.publishCandidates, "publish-readiness", "publishCandidates");
  requireArray(plan.buildOrder, "publish-readiness", "buildOrder");
  return plan;
}

export function loadValidatedPublishManifestContract(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    throw publishContractError("publish-artifacts", `expected publish manifest file at ${manifestPath}.`);
  }

  const manifest = readJson(manifestPath);
  requireObject(manifest, "publish-artifacts", "publish manifest payload");
  validateSchemaVersion(manifest, "publish-artifacts");
  if (manifest.kind !== "publish-artifact-manifest") {
    throw publishContractError("publish-artifacts", `kind must be "publish-artifact-manifest", received ${String(manifest.kind)}.`);
  }
  requireArray(manifest.packages, "publish-artifacts", "packages");
  return manifest;
}

export function loadValidatedBuildReportContract(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw publishContractError("publish-artifacts", `expected build report file at ${reportPath}.`);
  }

  const report = readJson(reportPath);
  requireObject(report, "publish-artifacts", "build report payload");
  validateSchemaVersion(report, "publish-artifacts");
  if (report.kind !== "publish-artifact-build-report") {
    throw publishContractError("publish-artifacts", `kind must be "publish-artifact-build-report", received ${String(report.kind)}.`);
  }
  requireArray(report.blockers, "publish-artifacts", "blockers");
  requireArray(report.builtDependencies, "publish-artifacts", "builtDependencies");
  requireArray(report.packedArtifacts, "publish-artifacts", "packedArtifacts");
  return report;
}

export function listPendingChangesetFiles(workspaceRoot) {
  const dirPath = path.join(workspaceRoot, ".changeset");
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((entry) => entry.endsWith(".md") && entry !== "README.md")
    .sort();
}

export function classifyNpmFailure(message) {
  const text = String(message);
  return {
    e404: /\bE404\b/i.test(text) || /404 Not Found/i.test(text),
  };
}

export function npmPackageExists(packageName) {
  const result = spawnSync(NPM, ["view", "--registry", NPM_PUBLIC_REGISTRY, packageName, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WINDOWS,
  });

  if (result.error) throw result.error;
  if (result.status === 0) return true;

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (classifyNpmFailure(combined).e404) {
    return false;
  }

  const snippet = combined.trim().split(/\r?\n/).slice(-40).join("\n");
  throw new Error(
    [
      `[publish-plan] npm view failed for ${packageName} (exit=${result.status ?? "unknown"})`,
      snippet ? `---\n${snippet}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function npmPackageVersionExists(packageName, version) {
  const result = spawnSync(NPM, ["view", "--registry", NPM_PUBLIC_REGISTRY, `${packageName}@${version}`, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WINDOWS,
  });

  if (result.error) throw result.error;
  if (result.status === 0) return true;

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (classifyNpmFailure(combined).e404) {
    return false;
  }

  const snippet = combined.trim().split(/\r?\n/).slice(-40).join("\n");
  throw new Error(
    [
      `[publish-plan] npm view failed for ${packageName}@${version} (exit=${result.status ?? "unknown"})`,
      snippet ? `---\n${snippet}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function getWorkspacePackages(workspaceRoot) {
  const raw = execFileSync(PNPM, ["-r", "list", "--depth", "-1", "--json"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    shell: IS_WINDOWS,
  });

  const items = JSON.parse(raw);
  const packages = new Map();

  for (const item of items) {
    if (!item?.name || !item?.path) continue;

    const dir = item.path;
    const packageJsonPath = path.join(dir, "package.json");
    if (!fs.existsSync(packageJsonPath)) continue;

    const manifest = readJson(packageJsonPath);
    packages.set(item.name, {
      name: manifest.name,
      version: manifest.version,
      private: Boolean(manifest.private),
      dir,
      packageJsonPath,
      changelogPath: path.join(dir, "CHANGELOG.md"),
      scripts: manifest.scripts ?? {},
      dependencies: manifest.dependencies ?? {},
      optionalDependencies: manifest.optionalDependencies ?? {},
      peerDependencies: manifest.peerDependencies ?? {},
    });
  }

  return packages;
}

export function collectWorkspaceDependencyNames(pkg, workspacePackageNames) {
  const sections = [pkg.dependencies, pkg.optionalDependencies, pkg.peerDependencies];
  const names = new Set();

  // Publish artifact builds only need the runtime/package dependency closure, not test-only dev dependencies.
  for (const section of sections) {
    for (const depName of Object.keys(section)) {
      if (workspacePackageNames.has(depName)) {
        names.add(depName);
      }
    }
  }

  return Array.from(names).sort();
}

export function topoSortWorkspaceDependencies(workspacePackages, entryPackageNames) {
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  const workspaceNames = new Set(workspacePackages.keys());

  function visit(packageName) {
    if (visited.has(packageName)) {
      return;
    }
    if (visiting.has(packageName)) {
      throw new Error(`[publish-plan] Circular workspace dependency detected around ${packageName}`);
    }

    const pkg = workspacePackages.get(packageName);
    if (!pkg) {
      throw new Error(`[publish-plan] Workspace package not found: ${packageName}`);
    }

    visiting.add(packageName);
    for (const dependencyName of collectWorkspaceDependencyNames(pkg, workspaceNames)) {
      visit(dependencyName);
    }
    visiting.delete(packageName);
    visited.add(packageName);
    ordered.push(packageName);
  }

  for (const packageName of entryPackageNames) {
    visit(packageName);
  }

  return ordered;
}

export function findPackedTarball(packDir) {
  const entries = fs
    .readdirSync(packDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tgz"))
    .map((entry) => path.join(packDir, entry.name))
    .sort();

  if (entries.length !== 1) {
    throw new Error(`[publish-artifacts] Expected exactly one tarball in ${packDir}, found ${entries.length}`);
  }

  return entries[0];
}
