#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  IS_WINDOWS,
  PNPM,
  ensureCleanDir,
  getWorkspacePackages,
  run,
  runWithOutput,
  writeJson,
} from "./publish-workspace-utils.mjs";

const workspaceRoot = process.cwd();
const outputRoot = path.join(workspaceRoot, "tmp", "generated-project-check");
const generatedProjectRoot = path.join(outputRoot, "starter-app");
const cliEntryPoint = path.join(workspaceRoot, "packages", "ztd-cli", "dist", "index.js");
const postgresContainerName = "generated-project-check-postgres";

function isPublishTarget(pkg) {
  return (
    !pkg.private
    && pkg.dir.startsWith(path.join(workspaceRoot, "packages"))
    && !pkg.dir.includes(`${path.sep}templates${path.sep}`)
  );
}

function runIn(directory, command, args, options = {}) {
  return runWithOutput(command, args, {
    cwd: directory,
    shell: options.shell ?? IS_WINDOWS,
    ...options,
  });
}

function readPackageJson(directory) {
  return JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
}

function writePackageJson(directory, packageJson) {
  fs.writeFileSync(path.join(directory, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function toLocalFileDependency(rootDir, targetDir) {
  const relativeTarget = path.relative(rootDir, targetDir).replace(/\\/gu, "/");
  const withDotPrefix = relativeTarget.startsWith(".") ? relativeTarget : `./${relativeTarget}`;
  return `file:${withDotPrefix}`;
}

function buildLocalSourceOverrides(rootDir) {
  const packages = [...getWorkspacePackages(workspaceRoot).values()].filter(isPublishTarget);
  return Object.fromEntries(
    packages.map((pkg) => [pkg.name, toLocalFileDependency(rootDir, pkg.dir)]),
  );
}

function applyLocalSourceOverrides(appDir) {
  const packageJson = readPackageJson(appDir);
  packageJson.pnpm = {
    ...(packageJson.pnpm ?? {}),
    overrides: buildLocalSourceOverrides(appDir),
  };
  writePackageJson(appDir, packageJson);
}

function assertExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[generated-project verification] missing ${description}: ${filePath}`);
  }
}

function assertFileContains(filePath, needle, description) {
  const contents = fs.readFileSync(filePath, "utf8");
  if (!contents.includes(needle)) {
    throw new Error(`[generated-project verification] ${description} missing expected text ${needle}: ${filePath}`);
  }
}

function verifyStarterScaffold(appDir) {
  const packageJson = readPackageJson(appDir);
  const ztdCliDependency = packageJson.devDependencies?.["@rawsql-ts/ztd-cli"];
  if (!ztdCliDependency) {
    throw new Error("[generated-project verification] starter scaffold did not install @rawsql-ts/ztd-cli.");
  }
  if (!ztdCliDependency.startsWith("file:")) {
    throw new Error(`[generated-project verification] starter scaffold resolved @rawsql-ts/ztd-cli from a non-local source: ${ztdCliDependency}`);
  }
  if (packageJson.type !== "module") {
    throw new Error(`[generated-project verification] starter scaffold package.json must set type=module, received: ${String(packageJson.type)}`);
  }
  const requiredImports = {
    "#features/*.js": {
      types: "./src/features/*.ts",
      default: "./dist/features/*.js",
    },
    "#libraries/*.js": {
      types: "./src/libraries/*.ts",
      default: "./dist/libraries/*.js",
    },
    "#adapters/*.js": {
      types: "./src/adapters/*.ts",
      default: "./dist/adapters/*.js",
    },
    "#tests/*.js": {
      types: "./tests/*.ts",
      default: "./tests/*.ts",
    },
  };
  for (const [key, value] of Object.entries(requiredImports)) {
    if (JSON.stringify(packageJson.imports?.[key]) !== JSON.stringify(value)) {
      throw new Error(`[generated-project verification] starter scaffold package.json is missing ${key}: ${JSON.stringify(packageJson.imports?.[key])}`);
    }
  }
  assertExists(path.join(appDir, "README.md"), "starter README");
  assertExists(path.join(appDir, "src", "features", "smoke", "tests", "smoke.boundary.test.ts"), "starter smoke boundary test");
  assertExists(
    path.join(appDir, "src", "features", "smoke", "queries", "smoke", "tests", "smoke.boundary.ztd.test.ts"),
    "starter DB-backed smoke test"
  );
  assertFileContains(path.join(appDir, "tsconfig.json"), "\"#libraries/*\"", "starter tsconfig");
  assertFileContains(path.join(appDir, "tsconfig.json"), "\"#adapters/*\"", "starter tsconfig");
  assertFileContains(path.join(appDir, "vitest.config.ts"), "'#libraries'", "starter vitest config");
  assertFileContains(path.join(appDir, "vitest.config.ts"), "'#adapters'", "starter vitest config");
  assertFileContains(
    path.join(appDir, "src", "adapters", "pg", "sql-client.ts"),
    "from '#libraries/sql/sql-client.js'",
    "starter pg adapter import"
  );
  assertFileContains(
    path.join(appDir, "src", "adapters", "console", "repositoryTelemetry.ts"),
    "from '#libraries/telemetry/types.js'",
    "starter console adapter import"
  );
}

function verifyFeatureScaffold(appDir) {
  const featureRoot = path.join(appDir, "src", "features", "users-insert");
  assertExists(path.join(featureRoot, "boundary.ts"), "feature root boundary");
  assertExists(
    path.join(featureRoot, "tests", "users-insert.boundary.test.ts"),
    "feature boundary test"
  );
  assertExists(path.join(featureRoot, "queries", "insert-users", "boundary.ts"), "feature query boundary");
  assertExists(
    path.join(featureRoot, "queries", "insert-users", "insert-users.sql"),
    "feature SQL resource"
  );
}

function writeProjectEnvFile(appDir, dbPort) {
  const envExamplePath = path.join(appDir, ".env.example");
  const envPath = path.join(appDir, ".env");
  const envContents = fs.readFileSync(envExamplePath, "utf8").replace(
    /ZTD_DB_PORT=\d+/u,
    `ZTD_DB_PORT=${dbPort}`
  );
  fs.writeFileSync(envPath, envContents, "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPostgres(appDir) {
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      runIn(appDir, "docker", ["exec", postgresContainerName, "pg_isready", "-U", "ztd", "-d", "ztd"]);
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await sleep(2000);
    }
  }
}

function applyStarterSchema(appDir) {
  const schemaPath = path.join(appDir, "db", "ddl", "public.sql");
  runIn(appDir, "docker", [
    "cp",
    schemaPath,
    `${postgresContainerName}:/tmp/public.sql`,
  ]);
  runIn(appDir, "docker", [
    "exec",
    postgresContainerName,
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "ztd",
    "-d",
    "ztd",
    "-f",
    "/tmp/public.sql",
  ]);
}

async function main() {
  ensureCleanDir(outputRoot);
  ensureCleanDir(generatedProjectRoot);

  // Build the workspace first so the generated project can link against the local source checkout.
  run(PNPM, ["build:publish"]);

  let dockerStarted = false;

  try {
    runIn(generatedProjectRoot, process.execPath, [
      cliEntryPoint,
      "init",
      "--starter",
      "--yes",
      "--skip-install",
      "--local-source-root",
      workspaceRoot,
    ], {
      shell: false,
    });

    applyLocalSourceOverrides(generatedProjectRoot);
    runIn(generatedProjectRoot, PNPM, ["install", "--ignore-workspace", "--no-frozen-lockfile"]);

    verifyStarterScaffold(generatedProjectRoot);

    runIn(generatedProjectRoot, process.execPath, [
      path.join(generatedProjectRoot, "scripts", "local-source-guard.mjs"),
      "ztd",
      "feature",
      "scaffold",
      "--table",
      "users",
      "--action",
      "insert",
    ], {
      shell: false,
    });
    verifyFeatureScaffold(generatedProjectRoot);

    runIn(generatedProjectRoot, "docker", [
      "run",
      "-d",
      "--rm",
      "--name",
      postgresContainerName,
      "-P",
      "-e",
      "POSTGRES_DB=ztd",
      "-e",
      "POSTGRES_PASSWORD=ztd",
      "-e",
      "POSTGRES_USER=ztd",
      "postgres:18",
    ]);
    dockerStarted = true;

    const portOutput = runIn(generatedProjectRoot, "docker", [
      "port",
      postgresContainerName,
      "5432/tcp",
    ]).stdout.trim();
    const match = portOutput.match(/:(\d+)(?:\r?\n)?$/u);
    if (!match) {
      throw new Error(`[generated-project verification] could not determine the mapped Postgres port from: ${portOutput}`);
    }
    const starterDbPort = Number(match[1]);
    if (!Number.isInteger(starterDbPort)) {
      throw new Error(`[generated-project verification] invalid mapped Postgres port: ${match[1]}`);
    }

    writeProjectEnvFile(generatedProjectRoot, starterDbPort);
    await waitForPostgres(generatedProjectRoot);
    runIn(generatedProjectRoot, PNPM, [
      "vitest",
      "run",
      "src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts",
    ]);
    applyStarterSchema(generatedProjectRoot);
    runIn(generatedProjectRoot, PNPM, ["exec", "--", "ztd", "ztd-config"]);
    runIn(generatedProjectRoot, PNPM, ["test"]);

    writeJson(path.join(outputRoot, "summary.json"), {
      checkedAt: new Date().toISOString(),
      node: process.version,
      platform: os.platform(),
      generatedProjectRoot,
      dbPort: starterDbPort,
      commands: [
        "build:publish",
        "ztd init --starter --yes --skip-install --local-source-root <repo-root>",
        "write pnpm.overrides for local rawsql-ts workspace packages",
        "pnpm install --ignore-workspace --no-frozen-lockfile",
        "node scripts/local-source-guard.mjs ztd feature scaffold --table users --action insert",
        "docker run -d --rm --name generated-project-check-postgres -P postgres:18",
        "docker port generated-project-check-postgres 5432/tcp",
        "write .env with the mapped Postgres port",
        "pnpm vitest run src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts",
        "docker cp db/ddl/public.sql and apply it to the starter Postgres container",
        "ztd ztd-config",
        "pnpm test",
      ],
      files: [
        "README.md",
        "src/features/smoke/tests/smoke.boundary.test.ts",
        "src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts",
        "src/features/users-insert/tests/users-insert.boundary.test.ts",
        "src/features/users-insert/queries/insert-users/boundary.ts",
        "src/features/users-insert/queries/insert-users/insert-users.sql",
      ],
    });
  } finally {
    if (dockerStarted) {
      try {
        runIn(generatedProjectRoot, "docker", ["rm", "-f", postgresContainerName]);
      } catch {
        // Keep the main failure visible; cleanup is best-effort only.
      }
    }
  }
}

await main();
