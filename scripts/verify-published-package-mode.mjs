#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  IS_WINDOWS,
  NPM,
  PNPM,
  ensureCleanDir,
  getWorkspacePackages,
  runWithOutput,
  writeJson,
} from "./publish-workspace-utils.mjs";

const workspaceRoot = process.cwd();
const tarCommand = "tar";
const outputRoot = path.join(workspaceRoot, "tmp", "published-package-check");
const tarballRoot = path.join(outputRoot, "tarballs");
const packageRoot = path.join(outputRoot, "packages");

function sanitizePackageName(packageName) {
  return packageName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function toFileSpecifier(filePath) {
  return pathToFileURL(path.resolve(filePath)).href;
}

function isPublishTarget(pkg) {
  return (
    !pkg.private
    && pkg.dir.startsWith(path.join(workspaceRoot, "packages"))
    && !pkg.dir.includes(`${path.sep}templates${path.sep}`)
  );
}

function readPackedManifest(tarballPath) {
  const { stdout } = runWithOutput(tarCommand, ["-xOf", tarballPath, "package/package.json"], {
    cwd: workspaceRoot,
  });
  return JSON.parse(stdout);
}

function listTarEntries(tarballPath) {
  const { stdout } = runWithOutput(tarCommand, ["-tf", tarballPath], {
    cwd: workspaceRoot,
  });
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectManifestPathsFromExports(exportsField, entries = new Set()) {
  if (typeof exportsField === "string") {
    entries.add(exportsField);
    return entries;
  }
  if (Array.isArray(exportsField)) {
    for (const value of exportsField) {
      collectManifestPathsFromExports(value, entries);
    }
    return entries;
  }
  if (exportsField && typeof exportsField === "object") {
    for (const value of Object.values(exportsField)) {
      collectManifestPathsFromExports(value, entries);
    }
  }
  return entries;
}

function assertNoWorkspaceProtocols(manifest, packageName) {
  const sections = ["dependencies", "optionalDependencies", "peerDependencies"];

  for (const section of sections) {
    const record = manifest[section] ?? {};
    for (const [dependencyName, version] of Object.entries(record)) {
      if (String(version).startsWith("workspace:")) {
        throw new Error(
          `[packaging contract] ${packageName} leaked a workspace protocol in ${section}: ${dependencyName}=${version}`,
        );
      }
    }
  }
}

function assertTarballHasDist(entries, packageName) {
  if (!entries.some((entry) => entry.startsWith("package/dist/"))) {
    throw new Error(`[packaging contract] ${packageName} tarball is missing dist/.`);
  }
}

function assertPathExistsInTarball(entries, packageName, manifestField, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || !relativePath.startsWith(".")) {
    return;
  }

  const normalized = `package/${relativePath.replace(/^\.\//u, "")}`;
  if (normalized.includes("*")) {
    const matcher = new RegExp(
      `^${normalized
        .split("*")
        .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
        .join(".+")}$`,
      "u",
    );
    if (entries.some((entry) => matcher.test(entry))) {
      return;
    }
  } else if (entries.includes(normalized)) {
    return;
  }

  if (!normalized.includes("*")) {
    throw new Error(
      `[packaging contract] ${packageName} ${manifestField} points to a missing file: ${relativePath}`,
    );
  }

  throw new Error(
    `[packaging contract] ${packageName} ${manifestField} glob did not match a packed file: ${relativePath}`,
  );
}

function assertManifestEntrypoints(manifest, entries, packageName) {
  if (typeof manifest.main === "string") {
    assertPathExistsInTarball(entries, packageName, "main", `./${manifest.main.replace(/^\.\//u, "")}`);
  }

  if (typeof manifest.types === "string") {
    assertPathExistsInTarball(entries, packageName, "types", `./${manifest.types.replace(/^\.\//u, "")}`);
  }

  if (typeof manifest.bin === "string") {
    assertPathExistsInTarball(entries, packageName, "bin", `./${manifest.bin.replace(/^\.\//u, "")}`);
  } else if (manifest.bin && typeof manifest.bin === "object") {
    for (const [binName, binPath] of Object.entries(manifest.bin)) {
      assertPathExistsInTarball(entries, packageName, `bin.${binName}`, `./${String(binPath).replace(/^\.\//u, "")}`);
    }
  }

  for (const exportPath of collectManifestPathsFromExports(manifest.exports)) {
    assertPathExistsInTarball(entries, packageName, "exports", exportPath);
  }
}

function writePackageJson(directory, packageJson) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function run(command, args, options = {}) {
  return runWithOutput(command, args, {
    cwd: workspaceRoot,
    shell: IS_WINDOWS,
    ...options,
  });
}

function runIn(directory, command, args, options = {}) {
  return runWithOutput(command, args, {
    cwd: directory,
    shell: options.shell ?? IS_WINDOWS,
    ...options,
  });
}

function createTarballDependencyMap(packages) {
  return Object.fromEntries(
    packages.map((pkg) => [pkg.name, toFileSpecifier(pkg.tarballPath)]),
  );
}

function setPackageTypeModule(directory) {
  const packageJsonPath = path.join(directory, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageJson.type = "module";
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function readPackageJson(directory) {
  return JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
}

function restoreTarballDependencies(directory, tarballDependencies) {
  const packageJsonPath = path.join(directory, "package.json");
  const packageJson = readPackageJson(directory);
  packageJson.devDependencies = {
    ...(packageJson.devDependencies ?? {}),
    ...tarballDependencies,
  };
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function writeNode16Tsconfig(directory) {
  const tsconfigPath = path.join(directory, "tsconfig.node16.json");
  writeJson(tsconfigPath, {
    extends: "./tsconfig.json",
    compilerOptions: {
      module: "Node16",
      moduleResolution: "Node16",
      noEmit: true,
    },
  });
}

function packPublishedPackages() {
  const workspacePackages = Array.from(getWorkspacePackages(workspaceRoot).values())
    .filter(isPublishTarget)
    .sort((left, right) => left.name.localeCompare(right.name));

  const packed = [];

  for (const pkg of workspacePackages) {
    const packDir = path.join(tarballRoot, sanitizePackageName(pkg.name));
    ensureCleanDir(packDir);
    runIn(pkg.dir, PNPM, ["pack", "--pack-destination", packDir]);

    const tarballs = fs
      .readdirSync(packDir)
      .filter((entry) => entry.endsWith(".tgz"))
      .map((entry) => path.join(packDir, entry));

    if (tarballs.length !== 1) {
      throw new Error(`Expected exactly one tarball for ${pkg.name}, found ${tarballs.length}.`);
    }

    const tarballPath = tarballs[0];
    const manifest = readPackedManifest(tarballPath);
    const entries = listTarEntries(tarballPath);

    assertTarballHasDist(entries, pkg.name);
    assertNoWorkspaceProtocols(manifest, pkg.name);
    assertManifestEntrypoints(manifest, entries, pkg.name);

    packed.push({
      dir: pkg.dir,
      manifest,
      name: pkg.name,
      tarballPath,
    });
  }

  return packed;
}

function verifyPackedTarballInstall(packages) {
  const appDir = path.join(packageRoot, "packed-install");
  ensureCleanDir(appDir);

  writePackageJson(appDir, {
    name: "packed-install-check",
    private: true,
    version: "0.0.0",
    type: "module",
    devDependencies: createTarballDependencyMap(packages),
  });

  runIn(appDir, NPM, ["install"]);
  runIn(appDir, NPM, ["exec", "--", "ztd", "--help"]);
  runIn(appDir, process.execPath, [
    "--input-type=module",
    "-e",
    "await import('@rawsql-ts/testkit-core'); await import('@rawsql-ts/sql-contract-zod');",
  ], { shell: false });

  return appDir;
}

function verifyNpmConsumerSmoke(packages) {
  const appDir = path.join(packageRoot, "npm-consumer-smoke");
  ensureCleanDir(appDir);
  const tarballDependencies = createTarballDependencyMap(packages);

  writePackageJson(appDir, {
    name: "npm-consumer-smoke",
    private: true,
    version: "0.0.0",
    devDependencies: tarballDependencies,
  });

  runIn(appDir, NPM, ["install"]);
  runIn(appDir, NPM, ["exec", "--", "ztd", "init", "--yes", "--workflow", "demo", "--validator", "zod"]);
  restoreTarballDependencies(appDir, tarballDependencies);
  runIn(appDir, NPM, ["install"]);
  runIn(appDir, NPM, ["exec", "--", "ztd", "ztd-config"]);

  setPackageTypeModule(appDir);
  writeNode16Tsconfig(appDir);

  runIn(appDir, NPM, ["exec", "--", "tsc", "--noEmit", "-p", "tsconfig.json"]);
  runIn(appDir, NPM, ["exec", "--", "tsc", "-p", "tsconfig.node16.json"]);

  return appDir;
}

function verifyOverwriteSafety(packages) {
  const appDir = path.join(packageRoot, "overwrite-safety");
  ensureCleanDir(appDir);

  writePackageJson(appDir, {
    name: "overwrite-safety-check",
    private: true,
    version: "0.0.0",
    devDependencies: createTarballDependencyMap(packages),
  });

  fs.mkdirSync(path.join(appDir, "ztd", "ddl"), { recursive: true });
  fs.writeFileSync(path.join(appDir, "ztd", "ddl", "public.sql"), "-- existing\n", "utf8");

  runIn(appDir, NPM, ["install"]);
  const ddlPath = path.join(appDir, "ztd", "ddl", "public.sql");
  const originalSchema = fs.readFileSync(ddlPath, "utf8");

  let overwriteFailed = false;
  try {
    runIn(appDir, NPM, ["exec", "--", "ztd", "init", "--yes", "--workflow", "empty", "--validator", "zod"]);
  } catch {
    overwriteFailed = true;
  }

  if (!overwriteFailed) {
    throw new Error("[scaffold safety] ztd init overwrote an existing DDL file without requiring --force.");
  }
  const afterFailedInit = fs.readFileSync(ddlPath, "utf8");
  if (afterFailedInit !== originalSchema) {
    throw new Error("[scaffold safety] DDL changed even though init without --force failed.");
  }

  runIn(appDir, NPM, ["exec", "--", "ztd", "init", "--yes", "--force", "--workflow", "demo", "--validator", "zod"]);

  const schemaContents = fs.readFileSync(ddlPath, "utf8");
  if (schemaContents === originalSchema) {
    throw new Error("[scaffold safety] --force did not overwrite the existing DDL file as expected.");
  }

  return appDir;
}

function main() {
  ensureCleanDir(outputRoot);
  ensureCleanDir(tarballRoot);
  ensureCleanDir(packageRoot);

  run(PNPM, ["build:publish"]);

  const packedPackages = packPublishedPackages();
  const packedInstallApp = verifyPackedTarballInstall(packedPackages);
  const npmSmokeApp = verifyNpmConsumerSmoke(packedPackages);
  const overwriteSafetyApp = verifyOverwriteSafety(packedPackages);

  writeJson(path.join(outputRoot, "summary.json"), {
    checkedAt: new Date().toISOString(),
    node: process.version,
    platform: os.platform(),
    packedInstallApp,
    npmSmokeApp,
    overwriteSafetyApp,
    packages: packedPackages.map((pkg) => ({
      name: pkg.name,
      version: pkg.manifest.version,
      tarballPath: pkg.tarballPath,
    })),
  });
}

main();
