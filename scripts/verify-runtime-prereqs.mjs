#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const options = {
    label: "runtime-check",
    commands: [],
    files: [],
    minNpmVersion: null,
    output: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] ?? "";

    if (arg === "--label") {
      options.label = next;
      index += 1;
      continue;
    }
    if (arg === "--commands") {
      options.commands = next.split(",").map((value) => value.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    if (arg === "--files") {
      options.files = next.split(",").map((value) => value.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    if (arg === "--min-npm-version") {
      options.minNpmVersion = next || null;
      index += 1;
      continue;
    }
    if (arg === "--output") {
      options.output = next || null;
      index += 1;
    }
  }

  return options;
}

function compareSemver(left, right) {
  const a = String(left).split(".").map((value) => Number.parseInt(value, 10));
  const b = String(right).split(".").map((value) => Number.parseInt(value, 10));

  for (let index = 0; index < 3; index += 1) {
    const av = Number.isFinite(a[index]) ? a[index] : 0;
    const bv = Number.isFinite(b[index]) ? b[index] : 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

function runVersion(command) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  if (result.error) {
    return {
      ok: false,
      command,
      version: null,
      message: result.error.message,
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      command,
      version: null,
      message: `${command} --version failed with exit code ${result.status ?? "unknown"}`,
    };
  }

  return {
    ok: true,
    command,
    version: (result.stdout ?? "").trim(),
    message: null,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const workspaceRoot = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const commandChecks = options.commands.map((command) => runVersion(command));
  const fileChecks = options.files.map((filePath) => ({
    path: filePath,
    exists: fs.existsSync(path.resolve(workspaceRoot, filePath)),
  }));
  const failures = [];

  for (const check of commandChecks) {
    if (!check.ok) {
      failures.push(`[runtime-check] Missing required command "${check.command}": ${check.message}`);
    }
  }

  if (options.minNpmVersion) {
    const npmCheck = commandChecks.find((check) => check.command === "npm");
    if (!npmCheck?.ok) {
      failures.push(`[runtime-check] npm is required to validate minimum version ${options.minNpmVersion}.`);
    } else if (compareSemver(npmCheck.version, options.minNpmVersion) < 0) {
      failures.push(
        `[runtime-check] npm ${npmCheck.version} is below the required minimum ${options.minNpmVersion}.`,
      );
    }
  }

  for (const check of fileChecks) {
    if (!check.exists) {
      failures.push(`[runtime-check] Required file is missing: ${check.path}`);
    }
  }

  const report = {
    schemaVersion: 1,
    kind: "runtime-prereq-check",
    label: options.label,
    checkedAt: new Date().toISOString(),
    commands: commandChecks,
    files: fileChecks,
    ok: failures.length === 0,
    failures,
  };

  if (options.output) {
    writeJson(path.resolve(workspaceRoot, options.output), report);
  }

  for (const check of commandChecks) {
    if (check.ok) {
      console.log(`[runtime-check] ${check.command}=${check.version}`);
    }
  }
  for (const check of fileChecks) {
    console.log(`[runtime-check] file ${check.path}: ${check.exists ? "present" : "missing"}`);
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}

main();
