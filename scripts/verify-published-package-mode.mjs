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
  loadValidatedPublishManifestContract,
  runWithOutput,
  writeJson,
} from "./publish-workspace-utils.mjs";

const workspaceRoot = process.cwd();
const tarCommand = "tar";
const outputRoot = path.join(workspaceRoot, "tmp", "published-package-check");
const tarballRoot = path.join(outputRoot, "tarballs");
const packageRoot = path.join(outputRoot, "packages");

function parseArgs(argv) {
  const options = {
    publishManifestPath: null,
    publishManifestProvided: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--publish-manifest") {
      const nextArg = argv[index + 1];
      options.publishManifestProvided = true;
      if (typeof nextArg !== "string" || nextArg.trim().length === 0) {
        throw new Error("[published-package-mode] --publish-manifest requires a non-empty path.");
      }
      options.publishManifestPath = nextArg;
      index += 1;
    }
  }

  return options;
}

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
  const sections = ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies"];

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
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error(
      `[packaging contract] ${packageName} ${manifestField} must point to a non-empty relative path, received: ${String(relativePath)}`,
    );
  }

  if (!relativePath.startsWith("./")) {
    throw new Error(
      `[packaging contract] ${packageName} ${manifestField} must start with "./", received: ${relativePath}`,
    );
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

function hasTarballDependency(tarballDependencies, packageName) {
  return typeof tarballDependencies[packageName] === "string";
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

function loadPackedPackagesFromManifest(manifestPath) {
  const resolvedManifestPath = path.isAbsolute(manifestPath)
    ? manifestPath
    : path.resolve(workspaceRoot, manifestPath);
  const manifestContract = loadValidatedPublishManifestContract(resolvedManifestPath);

  return manifestContract.packages.map((pkg) => {
    const manifest = readPackedManifest(pkg.resolvedTarballPath);
    const entries = listTarEntries(pkg.resolvedTarballPath);

    assertTarballHasDist(entries, pkg.name);
    assertNoWorkspaceProtocols(manifest, pkg.name);
    assertManifestEntrypoints(manifest, entries, pkg.name);

    return {
      dir: pkg.dir,
      manifest,
      name: pkg.name,
      tarballPath: pkg.resolvedTarballPath,
    };
  });
}

function verifyPackedTarballInstall(packages) {
  const appDir = path.join(packageRoot, "packed-install");
  ensureCleanDir(appDir);
  const tarballDependencies = createTarballDependencyMap(packages);

  writePackageJson(appDir, {
    name: "packed-install-check",
    private: true,
    version: "0.0.0",
    type: "module",
    devDependencies: tarballDependencies,
  });

  runIn(appDir, NPM, ["install"]);

  const smokeImportTargets = [
    "@rawsql-ts/testkit-core",
  ].filter((packageName) => hasTarballDependency(tarballDependencies, packageName));

  if (smokeImportTargets.length > 0) {
    runIn(appDir, process.execPath, [
      "--input-type=module",
      "-e",
      smokeImportTargets
        .map((packageName) => `await import(${JSON.stringify(packageName)});`)
        .join(" "),
    ], { shell: false });
  }

  return appDir;
}

function verifyCoreGettingStarted(packages) {
  const appDir = path.join(packageRoot, "rawsql-ts-getting-started");
  const tarballDependencies = createTarballDependencyMap(packages);

  if (!hasTarballDependency(tarballDependencies, "rawsql-ts")) {
    return null;
  }

  ensureCleanDir(appDir);

  writePackageJson(appDir, {
    name: "rawsql-ts-getting-started-check",
    private: true,
    version: "0.0.0",
    type: "module",
    devDependencies: {
      "rawsql-ts": tarballDependencies["rawsql-ts"],
    },
  });

  runIn(appDir, NPM, ["install"]);
  runIn(appDir, process.execPath, [
    "--input-type=module",
    "-e",
    [
      "const { DynamicQueryBuilder, SqlFormatter } = await import('rawsql-ts');",
      "const baseSql = `",
      "  SELECT id, name, email, status, created_at",
      "  FROM users",
      "  WHERE active = true",
      "    AND (:status IS NULL OR status = :status)",
      "`;",
      "const builder = new DynamicQueryBuilder();",
      "const query = builder.buildQuery(baseSql, {",
      "  filter: { status: 'premium' },",
      "  sort: { created_at: { desc: true }, name: { asc: true } },",
      "  paging: { page: 2, pageSize: 10 },",
      "  optionalConditionParameters: { status: 'premium' },",
      "});",
      "const formatter = new SqlFormatter();",
      "const { formattedSql, params } = formatter.format(query);",
      "if (!String(formattedSql).includes('users')) throw new Error('formatted SQL did not include the expected table reference');",
      "if (params == null) throw new Error('formatter did not return params');",
    ].join(" "),
  ], { shell: false });

  return appDir;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureCleanDir(outputRoot);
  ensureCleanDir(tarballRoot);
  ensureCleanDir(packageRoot);

  const packedPackages = options.publishManifestProvided
    ? loadPackedPackagesFromManifest(options.publishManifestPath)
    : (() => {
        run(PNPM, ["build:publish"]);
        return packPublishedPackages();
      })();
  const packedInstallApp = verifyPackedTarballInstall(packedPackages);
  const coreGettingStartedApp = verifyCoreGettingStarted(packedPackages);

  writeJson(path.join(outputRoot, "summary.json"), {
    checkedAt: new Date().toISOString(),
    node: process.version,
    platform: os.platform(),
    verificationMode: options.publishManifestProvided ? "publish-manifest" : "workspace-pack",
    packedInstallApp,
    coreGettingStartedApp,
    packages: packedPackages.map((pkg) => ({
      name: pkg.name,
      version: pkg.manifest.version,
      tarballPath: pkg.tarballPath,
    })),
  });
}

main();
