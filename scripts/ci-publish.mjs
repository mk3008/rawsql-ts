#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const IS_WINDOWS = process.platform === "win32";
const PNPM = "pnpm";
const NPM = "npm";
const GIT = "git";
const GH = "gh";

// Always target the public npm registry explicitly to avoid .npmrc/env quirks.
const NPM_PUBLIC_REGISTRY = "https://registry.npmjs.org";

// If true, a GitHub Release failure will fail the script (even if npm publish succeeded).
// Default: false (publish is the primary responsibility).
const FAIL_ON_RELEASE_ERROR = process.env.RAWSQL_FAIL_ON_RELEASE_ERROR === "1";

function run(command, args, options = {}) {
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

function runWithOutput(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WINDOWS,
    ...options,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) throw result.error;

  const status = typeof result.status === "number" ? result.status : null;
  if (status !== null && status !== 0) {
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    const snippet = combined ? combined.split(/\r?\n/).slice(-60).join("\n") : "";
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with exit code ${status}`,
        snippet ? `---\n${snippet}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function tryRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
    shell: IS_WINDOWS,
    ...options,
  });

  if (result.error) return { ok: false, status: null };
  return { ok: result.status === 0, status: result.status };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getFixedPackageNames(workspaceRoot) {
  const configPath = path.join(workspaceRoot, ".changeset", "config.json");
  const config = readJson(configPath);

  const fixedGroups = Array.isArray(config.fixed) ? config.fixed : [];
  const fixedGroup = fixedGroups[0];
  if (!Array.isArray(fixedGroup) || fixedGroup.length === 0) {
    throw new Error(`No fixed group found in ${configPath}`);
  }
  return fixedGroup;
}

function getWorkspacePackageDirByName() {
  const raw = execFileSync(PNPM, ["-r", "list", "--depth", "-1", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    shell: IS_WINDOWS,
  });
  const items = JSON.parse(raw);

  const map = new Map();
  for (const item of items) {
    if (!item?.name || !item?.path) continue;
    map.set(item.name, item.path);
  }
  return map;
}

function detectPublishAuth() {
  // Make auth mode explicit and stable:
  // - RAWSQL_PUBLISH_AUTH=oidc (recommended in CI)
  // - RAWSQL_PUBLISH_AUTH=token (local fallback / emergency)
  const raw = process.env.RAWSQL_PUBLISH_AUTH;
  if (raw === "oidc" || raw === "token") {
    console.log(`[publish] auth=${raw} (source=RAWSQL_PUBLISH_AUTH)`);
    return raw;
  }

  // Default to OIDC to avoid accidental token-based auth (which can mask OIDC issues).
  console.log("[publish] auth=oidc (source=default)");
  return "oidc";
}

function logOidcEnvironment(publishAuth) {
  if (publishAuth !== "oidc") return;

  const idTokenUrlSet = Boolean(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  const idTokenTokenSet = Boolean(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN);

  console.log(
    [
      "[publish] oidc diagnostics:",
      `  ACTIONS_ID_TOKEN_REQUEST_URL=${idTokenUrlSet ? "(set)" : "(missing)"}`,
      `  ACTIONS_ID_TOKEN_REQUEST_TOKEN=${idTokenTokenSet ? "(set)" : "(missing)"}`,
      `  NPM_CONFIG_PROVENANCE=${process.env.NPM_CONFIG_PROVENANCE ? process.env.NPM_CONFIG_PROVENANCE : "(unset)"}`,
      `  NODE_AUTH_TOKEN=${process.env.NODE_AUTH_TOKEN ? "(set)" : "(unset)"}`,
    ].join("\n"),
  );
}

function ensureTokenUserConfig(workspaceRoot) {
  // Create a dedicated npmrc that uses NODE_AUTH_TOKEN for auth, independent of actions/setup-node output.
  const tokenNpmrcDir = path.join(workspaceRoot, "tmp", "publish-token");
  ensureDir(tokenNpmrcDir);

  const tokenUserConfig = path.join(tokenNpmrcDir, "npmrc");
  fs.writeFileSync(
    tokenUserConfig,
    [
      `registry=${NPM_PUBLIC_REGISTRY}`,
      `//registry.npmjs.org/:_authToken=\${NODE_AUTH_TOKEN}`,
      "",
    ].join("\n"),
    "utf8",
  );

  return tokenUserConfig;
}

function sanitizeOidcEnvironment(publishAuth, workspaceRoot) {
  if (publishAuth !== "oidc") return;

  // npm can prefer token-based auth when NODE_AUTH_TOKEN exists, which can break OIDC Trusted Publishing.
  // Remove it proactively so downstream npm commands run in a clean OIDC environment.
  if (process.env.NODE_AUTH_TOKEN) {
    console.warn("[publish] warning: NODE_AUTH_TOKEN is set; removing it to avoid token-based auth overriding OIDC.");
    delete process.env.NODE_AUTH_TOKEN;
  }

  // Ensure npm doesn't pick up token auth from user-level config written by actions/setup-node or pre-existing runner config.
  // Use an empty, explicit user config in tmp/ so OIDC Trusted Publishing can work reliably.
  const oidcNpmrcDir = path.join(workspaceRoot, "tmp", "oidc");
  ensureDir(oidcNpmrcDir);

  const oidcUserConfig = path.join(oidcNpmrcDir, "npmrc");
  fs.writeFileSync(
    oidcUserConfig,
    [
      `registry=${NPM_PUBLIC_REGISTRY}`,
      "always-auth=false",
      "",
    ].join("\n"),
    "utf8",
  );

  if (process.env.NPM_CONFIG_USERCONFIG && process.env.NPM_CONFIG_USERCONFIG !== oidcUserConfig) {
    console.warn(
      `[publish] warning: overriding NPM_CONFIG_USERCONFIG (${process.env.NPM_CONFIG_USERCONFIG}) for OIDC Trusted Publishing.`,
    );
  }
  process.env.NPM_CONFIG_USERCONFIG = oidcUserConfig;
}

function getNpmVersion() {
  const res = spawnSync(NPM, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WINDOWS,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    const combined = `${res.stdout ?? ""}\n${res.stderr ?? ""}`.trim();
    throw new Error(`[publish] npm --version failed (exit=${res.status ?? "unknown"})\n---\n${combined}`);
  }
  return (res.stdout ?? "").trim();
}

function compareSemver(a, b) {
  const pa = String(a).split(".").map((x) => Number.parseInt(x, 10));
  const pb = String(b).split(".").map((x) => Number.parseInt(x, 10));
  for (let i = 0; i < 3; i += 1) {
    const da = Number.isFinite(pa[i]) ? pa[i] : 0;
    const db = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

function classifyNpmFailure(text) {
  const t = String(text ?? "");
  const code = {
    needAuth: /\bENEEDAUTH\b/i.test(t) || /\bneed auth\b/i.test(t),
    e401: /\bE401\b/i.test(t) || /\b401\b.*\bUnauthorized\b/i.test(t),
    e403: /\bE403\b/i.test(t) || /\b403\b.*\bForbidden\b/i.test(t),
    e404: /\bE404\b/i.test(t) || /\bnpm ERR!\s*404\b/i.test(t) || /\b404\b.*\bNot Found\b/i.test(t),
    tokenExpiredOrRevoked: /\bAccess token expired or revoked\b/i.test(t),
  };
  return code;
}

function ensureOidcPrereqs(publishAuth) {
  if (publishAuth !== "oidc") return;

  const npmVer = getNpmVersion();
  console.log(`[publish] npm version=${npmVer}`);

  const min = "11.5.1";
  if (compareSemver(npmVer, min) < 0) {
    throw new Error(
      [
        `[publish] npm ${npmVer} is too old for OIDC Trusted Publishing.`,
        `Install npm >= ${min} (e.g., "npm i -g npm@^${min}") in the workflow before running this script.`,
      ].join("\n"),
    );
  }

  const reg = runWithOutput(NPM, ["config", "get", "registry"]).stdout.trim();
  console.log(`[publish] npm registry=${reg || "(empty)"}`);
  if (reg && reg !== `${NPM_PUBLIC_REGISTRY}/` && reg !== NPM_PUBLIC_REGISTRY) {
    console.log(
      `[publish] warning: npm registry is not the public registry. This script forces --registry ${NPM_PUBLIC_REGISTRY} for publish/view.`,
    );
  }
}

function npmPackageVersionExists(packageName, version) {
  const result = spawnSync(NPM, ["view", "--registry", NPM_PUBLIC_REGISTRY, `${packageName}@${version}`, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WINDOWS,
  });

  if (result.error) throw result.error;
  if (result.status === 0) return true;

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const { e404 } = classifyNpmFailure(combined);
  if (e404) return false;

  const snippet = combined.trim().split(/\r?\n/).slice(-40).join("\n");
  throw new Error(
    [
      `[publish] npm view failed for ${packageName}@${version} (exit=${result.status ?? "unknown"})`,
      snippet ? `---\n${snippet}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function publishWithNpm(packageDir, publishAuth, opts) {
  const args = ["publish", "--registry", NPM_PUBLIC_REGISTRY, "--access", "public"];

  if (publishAuth === "oidc") {
    // OIDC Trusted Publishing requires provenance.
    args.push("--provenance");
  }

  try {
    runWithOutput(NPM, args, { cwd: packageDir });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const c = classifyNpmFailure(message);

    if (publishAuth === "oidc") {
      const canFallback =
        opts?.allowTokenFallback === true && Boolean(opts?.preservedNodeAuthToken) && Boolean(opts?.workspaceRoot);

      const reasons = [];
      if (c.needAuth) reasons.push("ENEEDAUTH (npm thinks you are not logged in)");
      if (c.e401) reasons.push("E401 Unauthorized");
      if (c.e403) reasons.push("E403 Forbidden");
      if (c.e404) reasons.push("E404 Not Found (sometimes permission/auth is masked as 404)");

      if (canFallback && (c.needAuth || c.e401 || c.e403)) {
        // OIDC can fail if Trusted Publishers isn't configured or the workflow context doesn't match.
        // When allowed, retry with token auth so releases aren't blocked.
        console.warn("[publish] OIDC publish failed; retrying with token auth fallback.");

        process.env.NODE_AUTH_TOKEN = opts.preservedNodeAuthToken;
        process.env.NPM_CONFIG_USERCONFIG = ensureTokenUserConfig(opts.workspaceRoot);

        try {
          runWithOutput(NPM, ["publish", "--registry", NPM_PUBLIC_REGISTRY, "--access", "public"], { cwd: packageDir });
          return;
        } catch (fallbackError) {
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          const fc = classifyNpmFailure(fallbackMessage);

          const fallbackHint = [
            "[publish] token auth fallback failed.",
            fc.tokenExpiredOrRevoked ? "Reason signals: token expired or revoked" : "Reason signals: (unknown)",
            "Checklist (most likely first):",
            "  1) rotate the npm token secret (classic tokens may be revoked; use a valid granular/automation token)",
            "  2) ensure the token has publish access to this package",
            "  3) or disable fallback and configure npm Trusted Publishers for OIDC",
          ].join("\n");

          throw new Error([fallbackHint, `---\n${fallbackMessage}`].join("\n"));
        }
      }

      const hint = [
        "[publish] npm publish failed (OIDC mode).",
        reasons.length ? `Reason signals: ${reasons.join(", ")}` : "Reason signals: (unknown)",
        "Checklist (most likely first):",
        "  1) npm Trusted Publisher is configured for THIS package and THIS workflow file in THIS repo",
        "  2) workflow permissions include: id-token: write",
        "  3) NODE_AUTH_TOKEN is NOT set anywhere (env, secrets, org vars)",
        `  4) npm >= 11.5.1 and registry is ${NPM_PUBLIC_REGISTRY}`,
        "  5) npm publish includes --provenance (this script adds it in oidc mode)",
        opts?.allowTokenFallback === true
          ? "  6) (fallback enabled) ensure a valid NODE_AUTH_TOKEN is available for token auth retry"
          : "  6) (optional) enable RAWSQL_PUBLISH_OIDC_FALLBACK_TO_TOKEN=1 to retry with NODE_AUTH_TOKEN",
      ].join("\n");

      throw new Error([hint, `---\n${message}`].join("\n"));
    }

    throw error;
  }
}

function gitTagExists(tagName) {
  return tryRun(GIT, ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`]).ok;
}

function createAnnotatedGitTag(tagName) {
  run(GIT, ["tag", "-a", tagName, "-m", tagName]);
}

function pushAllTags() {
  run(GIT, ["push", "--tags"]);
}

function ghReleaseExists(tagName) {
  return tryRun(GH, ["release", "view", tagName]).ok;
}

function sanitizeFilename(input) {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function extractChangelogSection(changelogMarkdown, version) {
  const lines = changelogMarkdown.split(/\r?\n/);
  const header = `## ${version}`;

  const startIndex = lines.findIndex((line) => line.trim() === header);
  if (startIndex === -1) return null;

  const content = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) break;
    content.push(line);
  }

  while (content.length > 0 && content[0].trim() === "") content.shift();
  while (content.length > 0 && content[content.length - 1].trim() === "") content.pop();

  return content.join("\n");
}

function createGitHubRelease(tagName, notesFilePath) {
  run(GH, ["release", "create", tagName, "--title", tagName, "--notes-file", notesFilePath]);
}

function main() {
  const workspaceRoot = process.cwd();
  const dryRun = process.env.RAWSQL_CI_DRY_RUN === "1";
  const publishAuth = detectPublishAuth();

  const preservedNodeAuthToken = process.env.NODE_AUTH_TOKEN || "";
  const allowTokenFallback = process.env.RAWSQL_PUBLISH_OIDC_FALLBACK_TO_TOKEN === "1";

  sanitizeOidcEnvironment(publishAuth, workspaceRoot);
  logOidcEnvironment(publishAuth);
  ensureOidcPrereqs(publishAuth);

  const fixedPackageNames = getFixedPackageNames(workspaceRoot);
  const dirByName = getWorkspacePackageDirByName();

  const tmpNotesDir = path.join(workspaceRoot, "tmp", "release-notes");
  ensureDir(tmpNotesDir);

  const packages = [];
  for (const packageName of fixedPackageNames) {
    const packageDir = dirByName.get(packageName);
    if (!packageDir) throw new Error(`Workspace package directory not found for "${packageName}"`);

    const pkgJsonPath = path.join(packageDir, "package.json");
    const pkg = readJson(pkgJsonPath);
    if (pkg.private) continue;

    packages.push({
      name: pkg.name,
      version: pkg.version,
      dir: packageDir,
      changelogPath: path.join(packageDir, "CHANGELOG.md"),
    });
  }

  const publishedNow = [];
  const releaseErrors = [];

  // Publish packages
  for (const pkg of packages) {
    const exists = npmPackageVersionExists(pkg.name, pkg.version);
    if (exists) {
      console.log(`[publish] ${pkg.name}@${pkg.version} already exists; skipping`);
      continue;
    }

    if (dryRun) {
      console.log(`[publish] (dry-run) would publish ${pkg.name}@${pkg.version}`);
      continue;
    }

    console.log(`[publish] publishing ${pkg.name}@${pkg.version}`);
    publishWithNpm(pkg.dir, publishAuth, {
      allowTokenFallback,
      preservedNodeAuthToken,
      workspaceRoot,
    });
    publishedNow.push(`${pkg.name}@${pkg.version}`);
  }

  // Create tags
  for (const pkg of packages) {
    const tagName = `${pkg.name}@${pkg.version}`;
    if (gitTagExists(tagName)) {
      console.log(`[tag] ${tagName} already exists; skipping`);
      continue;
    }

    if (dryRun) {
      console.log(`[tag] (dry-run) would create ${tagName}`);
      continue;
    }

    console.log(`[tag] creating ${tagName}`);
    createAnnotatedGitTag(tagName);
  }

  // Push tags
  if (!dryRun) {
    pushAllTags();
  } else {
    console.log("[tag] (dry-run) would push tags");
  }

  // Create GitHub releases (best-effort by default)
  for (const pkg of packages) {
    const tagName = `${pkg.name}@${pkg.version}`;

    if (dryRun) {
      console.log(`[release] (dry-run) would create ${tagName}`);
      continue;
    }

    if (ghReleaseExists(tagName)) {
      console.log(`[release] ${tagName} already exists; skipping`);
      continue;
    }

    let notes = `Release ${tagName}\n`;
    if (fs.existsSync(pkg.changelogPath)) {
      const changelog = fs.readFileSync(pkg.changelogPath, "utf8");
      const section = extractChangelogSection(changelog, pkg.version);
      if (section) notes = section;
    }

    const notesFile = path.join(tmpNotesDir, `${sanitizeFilename(tagName)}.md`);
    fs.writeFileSync(notesFile, notes, "utf8");

    try {
      console.log(`[release] creating ${tagName}`);
      createGitHubRelease(tagName, notesFile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const full = `[release] failed to create ${tagName}\n---\n${msg}`;
      releaseErrors.push(full);
      console.error(full);

      if (FAIL_ON_RELEASE_ERROR) {
        throw new Error(full);
      }
    }
  }

  // Summary
  if (publishedNow.length === 0) {
    console.log("[publish] no packages were published (all versions already exist)");
  } else {
    console.log(`[publish] published: ${publishedNow.join(", ")}`);
  }

  if (releaseErrors.length > 0) {
    console.log(`[release] completed with ${releaseErrors.length} error(s).`);
    console.log(
      "[release] To fail the workflow on release errors, set RAWSQL_FAIL_ON_RELEASE_ERROR=1.",
    );
  }
}

main();
