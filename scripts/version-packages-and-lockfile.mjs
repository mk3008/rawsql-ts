import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const releaseVersionAttempts = 3;
const releaseVersionRetryDelayMs = 5000;
const useShell = process.platform === "win32";

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: useShell,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function runWithRetry(command, args, attempts) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: useShell,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status === 0) {
      return;
    }

    if (attempt === attempts) {
      process.exit(result.status ?? 1);
    }

    console.warn(
      `[release-version] ${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}; retrying ` +
        `(${attempt + 1}/${attempts}) in ${releaseVersionRetryDelayMs / 1000}s...`,
    );
    await wait(releaseVersionRetryDelayMs);
  }
}

// Version packages first, then regenerate the lockfile so the release PR commit stays installable.
await runWithRetry(pnpm, ["changeset", "version"], releaseVersionAttempts);
run(pnpm, ["install", "--lockfile-only", "--ignore-scripts"]);
