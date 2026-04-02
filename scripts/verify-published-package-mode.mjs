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

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`[${label}] Expected output to include: ${needle}`);
  }
}

function assertExcludes(haystack, needle, label) {
  if (haystack.includes(needle)) {
    throw new Error(`[${label}] Unexpected output included: ${needle}`);
  }
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

function verifyNpmPrimaryPath(packages) {
  const appDir = path.join(packageRoot, "npm-primary-path");
  ensureCleanDir(appDir);
  const tarballDependencies = createTarballDependencyMap(packages);

  writePackageJson(appDir, {
    name: "npm-consumer-smoke",
    private: true,
    version: "0.0.0",
    devDependencies: tarballDependencies,
  });

  runIn(appDir, NPM, ["install"]);
  const initResult = runIn(appDir, NPM, ["exec", "--", "ztd", "init", "--yes", "--workflow", "demo", "--validator", "zod"]);

  assertIncludes(initResult.stdout, "npm run ztd -- ztd-config", "phase-a packaging-npm-primary-path-gate");
  assertIncludes(initResult.stdout, "npm run ztd -- model-gen", "phase-a packaging-npm-primary-path-gate");
  assertIncludes(initResult.stdout, "npm run test", "phase-a packaging-npm-primary-path-gate");
  assertExcludes(initResult.stdout, "pnpm exec ztd", "phase-a packaging-npm-primary-path-gate");
  assertExcludes(initResult.stdout, "pnpm test", "phase-a packaging-npm-primary-path-gate");

  const readme = fs.readFileSync(path.join(appDir, "README.md"), "utf8");
  assertIncludes(readme, "This scaffold starts from `ztd init`.", "phase-a scaffold-readme");
  assertIncludes(readme, "The project is feature-first by default:", "phase-a scaffold-readme");
  assertIncludes(
    readme,
    "Generate the starter flow with `ztd init --starter` when you want the removable `src/features/smoke/` sample feature",
    "phase-a scaffold-readme"
  );
  assertIncludes(
    readme,
    "If you need the repository telemetry seam that comes with the starter, use [Repository Telemetry Setup]",
    "phase-a scaffold-readme"
  );
  assertIncludes(
    readme,
    "For `queryId`-based investigation, read [Repository Telemetry Setup]",
    "phase-a scaffold-readme"
  );
  assertIncludes(
    readme,
    "For reverse lookup from observed SQL, read [Observed SQL Investigation]",
    "phase-a scaffold-readme"
  );
  assertIncludes(readme, "Use this short prompt:", "phase-a scaffold-readme");
  assertIncludes(readme, "Choose ztd init or ztd init --starter based on whether I want the removable starter sample.", "phase-a scaffold-readme");
  assertIncludes(readme, "Add `--with-dogfooding` if you want `PROMPT_DOGFOOD.md` for prompt review.", "phase-a scaffold-readme");
  assertIncludes(readme, "The feature-first path is successful when:", "phase-a scaffold-readme");
  assertExcludes(readme, "pnpm exec ztd ztd-config", "phase-a scaffold-readme");

  restoreTarballDependencies(appDir, tarballDependencies);
  runIn(appDir, NPM, ["install"]);

  return { appDir };
}

function verifyNpmConsumerSmoke(phaseAResult) {
  const { appDir } = phaseAResult;

  // Phase B proves the first generated smoke test can pass on the npm-first consumer path.
  runIn(appDir, NPM, ["exec", "--", "ztd", "ztd-config"]);

  // Keep the published command surface aligned with Further Reading docs by
  // exercising the opt-in join-direction flag from the packed CLI artifact.
  fs.mkdirSync(path.join(appDir, "tmp"), { recursive: true });
  fs.writeFileSync(path.join(appDir, "tmp", "join-direction-smoke.sql"), "select 1;\n", "utf8");
  const lintHelp = runIn(appDir, NPM, ["exec", "--", "ztd", "query", "lint", "--help"]);
  assertIncludes(lintHelp.stdout, "--rules <list>", "phase-b query-lint-help-surface");
  runIn(appDir, NPM, [
    "exec",
    "--",
    "ztd",
    "query",
    "lint",
    "--rules",
    "join-direction",
    "tmp/join-direction-smoke.sql",
  ]);

  setPackageTypeModule(appDir);
  writeNode16Tsconfig(appDir);

  runIn(appDir, NPM, ["test"]);
  runIn(appDir, NPM, ["exec", "--", "tsc", "--noEmit", "-p", "tsconfig.json"]);
  runIn(appDir, NPM, ["exec", "--", "tsc", "-p", "tsconfig.node16.json"]);

  return appDir;
}

function verifyPnpmStarterPath(packages) {
  const appDir = path.resolve(workspaceRoot, "..", "tmp", "published-package-check-standalone", "pnpm-starter-path");
  ensureCleanDir(appDir);

  const tarballDependencies = createTarballDependencyMap(packages);
  writePackageJson(appDir, {
    name: "pnpm-starter-path-check",
    private: true,
    version: "0.0.0",
    devDependencies: {
      "@rawsql-ts/ztd-cli": tarballDependencies["@rawsql-ts/ztd-cli"],
    },
    pnpm: {
      overrides: tarballDependencies,
    },
  });

  runIn(appDir, PNPM, ["install", "--no-frozen-lockfile"]);
  runIn(appDir, PNPM, [
    "exec",
    "--",
    "ztd",
    "init",
    "--starter",
    "--with-ai-guidance",
    "--with-dogfooding",
    "--yes",
    "--skip-install",
  ]);

  const scaffoldPackageJson = readPackageJson(appDir);
  scaffoldPackageJson.devDependencies = Object.fromEntries(
    Object.entries(scaffoldPackageJson.devDependencies ?? {}).map(([dependencyName, version]) => [
      dependencyName,
      tarballDependencies[dependencyName] ?? version,
    ]),
  );
  scaffoldPackageJson.pnpm = {
    ...(scaffoldPackageJson.pnpm ?? {}),
    overrides: tarballDependencies,
  };
  assertNoWorkspaceProtocols(scaffoldPackageJson, "starter-scaffold");

  // Rebind workspace packages to the freshly packed tarballs so the scaffold install exercises the published manifests.
  fs.writeFileSync(path.join(appDir, "package.json"), `${JSON.stringify(scaffoldPackageJson, null, 2)}\n`, "utf8");
  runIn(appDir, PNPM, ["install", "--no-frozen-lockfile"]);

  return appDir;
}

function verifyPnpmAdapterInstall(packages) {
  const appDir = path.resolve(workspaceRoot, "..", "tmp", "published-package-check-standalone", "pnpm-adapter-path");
  ensureCleanDir(appDir);

  const tarballDependencies = createTarballDependencyMap(packages);
  writePackageJson(appDir, {
    name: "pnpm-adapter-path-check",
    private: true,
    version: "0.0.0",
    devDependencies: {
      "@rawsql-ts/ztd-cli": tarballDependencies["@rawsql-ts/ztd-cli"],
    },
    pnpm: {
      overrides: tarballDependencies,
    },
  });

  runIn(appDir, PNPM, ["install", "--no-frozen-lockfile"]);
  runIn(appDir, PNPM, [
    "exec",
    "--",
    "ztd",
    "init",
    "--starter",
    "--with-ai-guidance",
    "--with-dogfooding",
    "--yes",
    "--skip-install",
  ]);

  const scaffoldPackageJson = readPackageJson(appDir);
  scaffoldPackageJson.devDependencies = {
    ...(scaffoldPackageJson.devDependencies ?? {}),
    "@rawsql-ts/adapter-node-pg": tarballDependencies["@rawsql-ts/adapter-node-pg"],
  };
  scaffoldPackageJson.pnpm = {
    ...(scaffoldPackageJson.pnpm ?? {}),
    overrides: tarballDependencies,
  };
  assertNoWorkspaceProtocols(scaffoldPackageJson, "adapter-scaffold");

  // Rebind the generated scaffold to packed tarballs so the adapter install exercises the published manifests.
  fs.writeFileSync(path.join(appDir, "package.json"), `${JSON.stringify(scaffoldPackageJson, null, 2)}\n`, "utf8");
  runIn(appDir, PNPM, ["install", "--no-frozen-lockfile"]);

  return appDir;
}

function verifyPnpmTutorialModelGen(packages) {
  const appDir = path.resolve(workspaceRoot, "..", "tmp", "published-package-check-standalone", "pnpm-tutorial-model-gen");
  ensureCleanDir(appDir);

  const tarballDependencies = createTarballDependencyMap(packages);
  writePackageJson(appDir, {
    name: "pnpm-tutorial-model-gen-check",
    private: true,
    version: "0.0.0",
    devDependencies: {
      "@rawsql-ts/ztd-cli": tarballDependencies["@rawsql-ts/ztd-cli"],
    },
    pnpm: {
      overrides: tarballDependencies,
    },
  });

  runIn(appDir, PNPM, ["install", "--no-frozen-lockfile"]);
  runIn(appDir, PNPM, [
    "exec",
    "--",
    "ztd",
    "init",
    "--starter",
    "--with-ai-guidance",
    "--with-dogfooding",
    "--yes",
    "--skip-install",
  ]);

  const scaffoldPackageJson = readPackageJson(appDir);
  scaffoldPackageJson.devDependencies = {
    ...(scaffoldPackageJson.devDependencies ?? {}),
    "@rawsql-ts/adapter-node-pg": tarballDependencies["@rawsql-ts/adapter-node-pg"],
  };
  scaffoldPackageJson.pnpm = {
    ...(scaffoldPackageJson.pnpm ?? {}),
    overrides: tarballDependencies,
  };
  assertNoWorkspaceProtocols(scaffoldPackageJson, "tutorial-model-gen-scaffold");

  // Rebind the generated scaffold to packed tarballs so the tutorial path exercises the published manifests.
  fs.writeFileSync(path.join(appDir, "package.json"), `${JSON.stringify(scaffoldPackageJson, null, 2)}\n`, "utf8");
  runIn(appDir, PNPM, ["install", "--no-frozen-lockfile"]);

  const usersSqlPath = path.join(appDir, "src", "features", "users", "persistence", "users.sql");
  fs.mkdirSync(path.dirname(usersSqlPath), { recursive: true });
  fs.writeFileSync(
    usersSqlPath,
    [
      "select",
      "  user_id,",
      "  email",
      "from users",
      "where user_id = :user_id",
      "",
    ].join("\n"),
    "utf8",
  );

  runIn(appDir, PNPM, ["exec", "--", "ztd", "ztd-config"]);

  const modelGenArgs = [
    "exec",
    "--",
    "ztd",
    "model-gen",
    "--probe-mode",
    "ztd",
    "--sql-root",
    "src/features/users/persistence",
    "src/features/users/persistence/users.sql",
    "--out",
    "src/features/users/persistence/users.spec.ts",
  ];

  if (process.env.ZTD_TEST_DATABASE_URL) {
    runIn(appDir, PNPM, modelGenArgs);
    const generatedSpec = fs.readFileSync(
      path.join(appDir, "src", "features", "users", "persistence", "users.spec.ts"),
      "utf8",
    );
    if (!generatedSpec.includes("export interface")) {
      throw new Error("[packaging contract] tutorial model-gen did not write the expected spec output.");
    }
  } else {
    const describeOutput = runIn(appDir, PNPM, [...modelGenArgs, "--describe-output", "--output", "json"]);

    const parsed = JSON.parse(describeOutput.stdout);
    if (parsed?.data?.outputs?.spec !== "TypeScript QuerySpec scaffold") {
      throw new Error(
        `[packaging contract] tutorial model-gen describe output was unexpected: ${JSON.stringify(parsed)}`,
      );
    }
  }

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

  fs.mkdirSync(path.join(appDir, "db", "ddl"), { recursive: true });
  fs.writeFileSync(path.join(appDir, "db", "ddl", "public.sql"), "-- existing\n", "utf8");

  runIn(appDir, NPM, ["install"]);
  const ddlPath = path.join(appDir, "db", "ddl", "public.sql");
  const originalSchema = fs.readFileSync(ddlPath, "utf8");

  let overwriteFailed = false;
  try {
    runIn(appDir, NPM, ["exec", "--", "ztd", "init", "--yes", "--workflow", "demo", "--validator", "zod"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("--force") && !message.includes("already exists")) {
      throw error;
    }
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
  const npmPrimaryPathApp = verifyNpmPrimaryPath(packedPackages);
  const npmSmokeApp = verifyNpmConsumerSmoke(npmPrimaryPathApp);
  const pnpmStarterApp = verifyPnpmStarterPath(packedPackages);
  const pnpmAdapterApp = verifyPnpmAdapterInstall(packedPackages);
  const pnpmTutorialModelGenApp = verifyPnpmTutorialModelGen(packedPackages);
  const overwriteSafetyApp = verifyOverwriteSafety(packedPackages);

  writeJson(path.join(outputRoot, "summary.json"), {
    checkedAt: new Date().toISOString(),
    node: process.version,
    platform: os.platform(),
    packedInstallApp,
    npmPrimaryPathApp: npmPrimaryPathApp.appDir,
    firstTestGateApp: npmSmokeApp,
    npmSmokeApp,
    pnpmStarterApp,
    pnpmAdapterApp,
    pnpmTutorialModelGenApp,
    overwriteSafetyApp,
    packages: packedPackages.map((pkg) => ({
      name: pkg.name,
      version: pkg.manifest.version,
      tarballPath: pkg.tarballPath,
    })),
  });
}

main();
