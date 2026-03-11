#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const workspaceRoot = process.cwd();
const isWindows = process.platform === "win32";
const pnpm = "pnpm";
const tar = "tar";
const noLockfileEnv = {
  ...process.env,
  npm_config_lockfile: "false",
};

const packagesToPack = [
  { name: "rawsql-ts", dir: "packages/core", tarball: "rawsql-ts-core.tgz" },
  { name: "@rawsql-ts/sql-contract", dir: "packages/sql-contract", tarball: "sql-contract.tgz" },
  { name: "@rawsql-ts/shared-binder", dir: "packages/_shared/binder", tarball: "shared-binder.tgz" },
  { name: "@rawsql-ts/test-evidence-core", dir: "packages/test-evidence-core", tarball: "test-evidence-core.tgz" },
  { name: "@rawsql-ts/test-evidence-renderer-md", dir: "packages/test-evidence-renderer-md", tarball: "test-evidence-renderer-md.tgz" },
  { name: "@rawsql-ts/testkit-core", dir: "packages/testkit-core", tarball: "testkit-core.tgz" },
  { name: "@rawsql-ts/testkit-postgres", dir: "packages/testkit-postgres", tarball: "testkit-postgres.tgz" },
  { name: "@rawsql-ts/adapter-node-pg", dir: "packages/adapters/adapter-node-pg", tarball: "adapter-node-pg.tgz" },
  { name: "@rawsql-ts/ztd-cli", dir: "packages/ztd-cli", tarball: "ztd-cli.tgz" },
];

const outputRoot = path.join(workspaceRoot, "tmp", "published-package-check");
const tarballRoot = path.join(outputRoot, "tarballs");
const appRoot = path.join(outputRoot, "standalone-app");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
    env: process.env,
    ...options,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }

  return result.stdout ?? "";
}

function ensureCleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function inspectPackedManifest(tarballPath) {
  const manifestText = run(tar, ["-xOf", tarballPath, "package/package.json"], {
    cwd: workspaceRoot,
  });
  const manifest = JSON.parse(manifestText);
  const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  const workspaceRefs = [];

  // Packed manifests must not leak workspace protocol references.
  for (const section of sections) {
    const deps = manifest[section] ?? {};
    for (const [name, version] of Object.entries(deps)) {
      if (String(version).startsWith("workspace:")) {
        workspaceRefs.push(`${section}:${name}=${version}`);
      }
    }
  }

  return { manifest, workspaceRefs };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toPortableFilePath(toPath) {
  const normalized = path.resolve(toPath).split(path.sep).join("/");
  return `file:${normalized}`;
}

function main() {
  ensureCleanDir(outputRoot);
  ensureCleanDir(tarballRoot);
  fs.mkdirSync(appRoot, { recursive: true });

  // Use the existing release build entrypoint so pack verification mirrors publish preparation.
  run(pnpm, ["build:publish"], { cwd: workspaceRoot });

  const summaries = [];
  const overrides = {};

  // Pack each published package and assert that workspace protocol references are rewritten.
  for (const pkg of packagesToPack) {
    const packageDir = path.join(workspaceRoot, pkg.dir);
    const tarballPath = path.join(tarballRoot, pkg.tarball);
    run(pnpm, ["pack", "--out", tarballPath], { cwd: packageDir });
    const { manifest, workspaceRefs } = inspectPackedManifest(tarballPath);

    if (workspaceRefs.length > 0) {
      throw new Error(`${pkg.name} leaked workspace protocol refs: ${workspaceRefs.join(", ")}`);
    }

    overrides[pkg.name] = toPortableFilePath(tarballPath);
    summaries.push({
      name: pkg.name,
      version: manifest.version,
      tarball: tarballPath,
    });
  }

  // Resolve internal packages from local tarballs so the standalone app can smoke-test unpublished combinations.
  writeJson(path.join(appRoot, "package.json"), {
    name: "published-package-check-app",
    private: true,
    version: "0.0.0",
    pnpm: {
      overrides,
    },
  });

  const ztdCliTarball = overrides["@rawsql-ts/ztd-cli"];
  run(pnpm, ["add", "-D", ztdCliTarball], { cwd: appRoot, env: noLockfileEnv });
  run(pnpm, ["exec", "ztd", "init", "--yes"], { cwd: appRoot, env: noLockfileEnv });
  run(pnpm, ["exec", "ztd", "ztd-config"], { cwd: appRoot, env: noLockfileEnv });
  run(pnpm, ["test"], { cwd: appRoot, env: noLockfileEnv });

  writeJson(path.join(outputRoot, "summary.json"), {
    checkedAt: new Date().toISOString(),
    node: process.version,
    platform: os.platform(),
    packages: summaries,
    smokeApp: appRoot,
  });
}

main();
