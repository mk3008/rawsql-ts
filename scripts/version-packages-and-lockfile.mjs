import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Version packages first, then regenerate the lockfile so the release PR commit stays installable.
run(pnpm, ["changeset", "version"]);
run(pnpm, ["install", "--lockfile-only", "--ignore-scripts"]);
