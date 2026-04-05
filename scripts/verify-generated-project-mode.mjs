#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  IS_WINDOWS,
  PNPM,
  ensureCleanDir,
  run,
  runWithOutput,
  writeJson,
} from "./publish-workspace-utils.mjs";

const workspaceRoot = process.cwd();
const outputRoot = path.join(workspaceRoot, "tmp", "generated-project-check");
const generatedProjectRoot = path.join(outputRoot, "starter-app");
const cliEntryPoint = path.join(workspaceRoot, "packages", "ztd-cli", "dist", "index.js");
const postgresContainerName = "generated-project-check-postgres";

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

function assertExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[generated-project verification] missing ${description}: ${filePath}`);
  }
}

function verifyStarterScaffold(appDir) {
  const packageJson = readPackageJson(appDir);
  if (!packageJson.devDependencies?.["@rawsql-ts/ztd-cli"]) {
    throw new Error("[generated-project verification] starter scaffold did not install @rawsql-ts/ztd-cli.");
  }
  assertExists(path.join(appDir, "README.md"), "starter README");
  assertExists(path.join(appDir, "src", "features", "smoke", "tests", "smoke.entryspec.test.ts"), "starter smoke boundary test");
  assertExists(
    path.join(appDir, "src", "features", "smoke", "queries", "smoke", "tests", "smoke.queryspec.ztd.test.ts"),
    "starter DB-backed smoke test"
  );
}

function verifyFeatureScaffold(appDir) {
  const featureRoot = path.join(appDir, "src", "features", "users-insert");
  assertExists(path.join(featureRoot, "spec.ts"), "feature root spec");
  assertExists(
    path.join(featureRoot, "tests", "users-insert.entryspec.test.ts"),
    "feature entryspec test"
  );
  assertExists(path.join(featureRoot, "queries", "insert-users", "spec.ts"), "feature query spec");
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
      "--local-source-root",
      workspaceRoot,
    ], {
      shell: false,
    });

    verifyStarterScaffold(generatedProjectRoot);

    runIn(generatedProjectRoot, PNPM, [
      "exec",
      "--",
      "ztd",
      "feature",
      "scaffold",
      "--table",
      "users",
      "--action",
      "insert",
    ]);
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
        "ztd init --starter --yes --local-source-root <repo-root>",
        "ztd feature scaffold --table users --action insert",
        "docker run -d --rm --name generated-project-check-postgres -P postgres:18",
        "docker port generated-project-check-postgres 5432/tcp",
        "write .env with the mapped Postgres port",
        "docker cp db/ddl/public.sql and apply it to the starter Postgres container",
        "ztd ztd-config",
        "pnpm test",
      ],
      files: [
        "README.md",
        "src/features/smoke/tests/smoke.entryspec.test.ts",
        "src/features/smoke/queries/smoke/tests/smoke.queryspec.ztd.test.ts",
        "src/features/users-insert/tests/users-insert.entryspec.test.ts",
        "src/features/users-insert/queries/insert-users/spec.ts",
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
