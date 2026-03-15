import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const IS_WINDOWS = process.platform === "win32";
export const PNPM = "pnpm";
export const NPM = "npm";
export const NPM_PUBLIC_REGISTRY = "https://registry.npmjs.org";

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
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
