#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadValidatedPublishManifestContract } from "./publish-workspace-utils.mjs";

const IS_WINDOWS = process.platform === "win32";
const NPM = "npm";
const TAR = "tar";
const GIT = "git";
const GH = "gh";
const FALLBACK_TOKEN_ENV = "RAWSQL_PUBLISH_FALLBACK_TOKEN";

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

function tryCaptureOutput(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WINDOWS,
    ...options,
  });

  if (result.error) {
    const msg = result.error instanceof Error ? result.error.message : String(result.error);
    return { ok: false, stdout: "", stderr: "", status: null, error: msg };
  }

  const status = typeof result.status === "number" ? result.status : null;
  const ok = status === 0;
  return {
    ok,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status,
    error: ok ? null : `${command} ${args.join(" ")} failed with exit code ${status ?? "unknown"}`,
  };
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

function ensureCommandAvailable(command) {
  const probe = spawnSync(command, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WINDOWS,
  });

  if (probe.error || probe.status !== 0) {
    const message = probe.error instanceof Error
      ? probe.error.message
      : `${command} --version failed with exit code ${probe.status ?? "unknown"}`;
    throw new Error(`[publish] Required command is missing or unusable: ${command}. ${message}`);
  }
}

function loadPublishManifest(workspaceRoot) {
  const manifestPath = process.env.RAWSQL_PUBLISH_MANIFEST;
  if (!manifestPath) {
    throw new Error("[publish-contract] Artifact contract violation (publish-artifacts): RAWSQL_PUBLISH_MANIFEST is required. Build and verify publish artifacts before running actual publish.");
  }

  const resolvedPath = path.isAbsolute(manifestPath)
    ? manifestPath
    : path.resolve(workspaceRoot, manifestPath);
  const manifest = loadValidatedPublishManifestContract(resolvedPath);
  const packages = Array.isArray(manifest.packages) ? manifest.packages : [];
  if (packages.length === 0) {
    throw new Error(`[publish-contract] Artifact contract violation (publish-artifacts): publish manifest has no packages: ${resolvedPath}`);
  }

  console.log(`[publish] using prebuilt publish manifest: ${resolvedPath}`);
  return packages.map((pkg) => ({
    name: pkg.name,
    version: pkg.version,
    dir: pkg.dir,
    changelogPath: pkg.changelogPath,
    publishSource: pkg.resolvedTarballPath ?? pkg.tarballPath,
    publishCwd: workspaceRoot,
  }));
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function appendQueryParam(urlString, key, value) {
  const u = new URL(urlString);
  u.searchParams.set(key, value);
  return u.toString();
}

function decodeJwtPart(part) {
  // JWT parts are base64url encoded. Convert to standard base64 first.
  const normalized = String(part)
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(part.length / 4) * 4, "=");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, value: null, error: msg };
  }
}

async function fetchOidcClaims() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) {
    return { ok: false, claims: null, error: "ACTIONS_ID_TOKEN_REQUEST_* is missing" };
  }

  // Ask for a token with an explicit audience to help debug audience mismatches.
  const url = appendQueryParam(requestUrl, "audience", "npm");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${requestToken}` },
  });

  const body = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      claims: null,
      error: `OIDC token request failed (status=${res.status})`,
      details: body.trim().split(/\r?\n/).slice(-10).join("\n"),
    };
  }

  const parsed = safeJsonParse(body);
  const token = parsed.ok && parsed.value?.value ? String(parsed.value.value) : "";
  if (!token) {
    return { ok: false, claims: null, error: "OIDC token response JSON parse failed" };
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return { ok: false, claims: null, error: "OIDC token is not a JWT" };
  }

  const payload = decodeJwtPart(parts[1]);
  const payloadJson = safeJsonParse(payload);
  if (!payloadJson.ok) {
    return { ok: false, claims: null, error: "OIDC token payload JSON parse failed" };
  }

  return { ok: true, claims: payloadJson.value, error: null };
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
  const workflowRef = process.env.GITHUB_WORKFLOW_REF || "(unset)";
  const ref = process.env.GITHUB_REF || "(unset)";
  const repo = process.env.GITHUB_REPOSITORY || "(unset)";
  const sha = process.env.GITHUB_SHA || "(unset)";
  const runId = process.env.GITHUB_RUN_ID || "(unset)";
  const attempt = process.env.GITHUB_RUN_ATTEMPT || "(unset)";
  const actor = process.env.GITHUB_ACTOR || "(unset)";
  const eventName = process.env.GITHUB_EVENT_NAME || "(unset)";

  console.log(
    [
      "[publish] oidc diagnostics:",
      `  GITHUB_REPOSITORY=${repo}`,
      `  GITHUB_WORKFLOW_REF=${workflowRef}`,
      `  GITHUB_REF=${ref}`,
      `  GITHUB_SHA=${sha}`,
      `  GITHUB_RUN_ID=${runId}`,
      `  GITHUB_RUN_ATTEMPT=${attempt}`,
      `  GITHUB_ACTOR=${actor}`,
      `  GITHUB_EVENT_NAME=${eventName}`,
      `  ACTIONS_ID_TOKEN_REQUEST_URL=${idTokenUrlSet ? "(set)" : "(missing)"}`,
      `  ACTIONS_ID_TOKEN_REQUEST_TOKEN=${idTokenTokenSet ? "(set)" : "(missing)"}`,
      `  NPM_CONFIG_PROVENANCE=${process.env.NPM_CONFIG_PROVENANCE ? process.env.NPM_CONFIG_PROVENANCE : "(unset)"}`,
      `  NODE_AUTH_TOKEN=${process.env.NODE_AUTH_TOKEN ? "(set)" : "(unset)"}`,
    ].join("\n"),
  );
}

async function logOidcTokenClaims(publishAuth) {
  if (publishAuth !== "oidc") return;

  // Fetch an OIDC token and print a small set of claims to debug Trusted Publishing configuration mismatches.
  // Do NOT print the token itself.
  const res = await fetchOidcClaims();
  if (!res.ok) {
    console.warn(`[publish] oidc token claims: unavailable (${res.error})`);
    if (res.details) console.warn(`[publish] oidc token claims details:\n${res.details}`);
    return;
  }

  const claims = res.claims ?? {};
  const pick = (k) => (typeof claims[k] === "string" || typeof claims[k] === "number" ? claims[k] : "(unset)");

  console.log(
    [
      "[publish] oidc token claims (selected):",
      `  iss=${pick("iss")}`,
      `  aud=${Array.isArray(claims.aud) ? claims.aud.join(",") : pick("aud")}`,
      `  sub=${pick("sub")}`,
      `  repository=${pick("repository")}`,
      `  ref=${pick("ref")}`,
      `  workflow=${pick("workflow")}`,
      `  job_workflow_ref=${pick("job_workflow_ref")}`,
      `  sha=${pick("sha")}`,
      `  run_id=${pick("run_id")}`,
      `  actor=${pick("actor")}`,
    ].join("\n"),
  );
}

function logNpmAuthDiagnostics(publishAuth) {
  if (publishAuth !== "oidc") return;

  // Print minimal npm config and auth state. Avoid dumping full config to reduce risk of leaking secrets.
  const userconfig = tryCaptureOutput(NPM, ["config", "get", "userconfig"]);
  const globalconfig = tryCaptureOutput(NPM, ["config", "get", "globalconfig"]);
  const authToken = tryCaptureOutput(NPM, ["config", "get", "//registry.npmjs.org/:_authToken"]);
  const whoami = tryCaptureOutput(NPM, ["whoami"]);

  console.log(
    [
      "[publish] npm auth diagnostics:",
      `  userconfig=${userconfig.ok ? userconfig.stdout.trim() : "(error)"}`,
      `  globalconfig=${globalconfig.ok ? globalconfig.stdout.trim() : "(error)"}`,
      `  //registry.npmjs.org/:_authToken=${authToken.ok ? (authToken.stdout.trim() ? "(set)" : "(unset)") : "(error)"}`,
      `  npm whoami=${whoami.ok ? whoami.stdout.trim() : "(failed)"}`,
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

function getPreservedPublishToken() {
  return process.env[FALLBACK_TOKEN_ENV] || process.env.NODE_AUTH_TOKEN || "";
}

function sanitizeOidcEnvironment(publishAuth, workspaceRoot) {
  if (publishAuth !== "oidc") return;

  // Remove auth tokens from the live environment so OIDC attempts stay pure until an explicit fallback retry.
  if (process.env.NODE_AUTH_TOKEN) {
    console.warn("[publish] warning: NODE_AUTH_TOKEN is set; removing it to avoid token-based auth overriding OIDC.");
    delete process.env.NODE_AUTH_TOKEN;
  }
  if (process.env[FALLBACK_TOKEN_ENV]) {
    console.warn(`[publish] warning: ${FALLBACK_TOKEN_ENV} is set; removing it until token fallback is needed.`);
    delete process.env[FALLBACK_TOKEN_ENV];
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

function logNpmViewDiagnostics(packageName) {
  // Provide a small amount of read-only registry context to help distinguish:
  // - "package does not exist" vs
  // - "package exists but publish auth failed" (Trusted Publishing mismatch, missing permissions, etc).
  // Keep output small and avoid dumping any auth-related config.
  const latest = tryCaptureOutput(NPM, ["view", "--registry", NPM_PUBLIC_REGISTRY, packageName, "version"]);
  const distTags = tryCaptureOutput(NPM, ["view", "--registry", NPM_PUBLIC_REGISTRY, packageName, "dist-tags", "--json"]);

  const latestLine = latest.ok ? latest.stdout.trim() : "(failed)";
  const distTagsLine = distTags.ok ? distTags.stdout.trim() : "(failed)";

  const trimmedDistTags = distTagsLine.length > 2000 ? `${distTagsLine.slice(0, 2000)}…` : distTagsLine;

  console.log(
    [
      "[publish] npm view diagnostics:",
      `  package=${packageName}`,
      `  latest=${latestLine || "(empty)"}`,
      `  dist-tags=${trimmedDistTags || "(empty)"}`,
    ].join("\n"),
  );
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPackageVersion(packageName, version, { attempts = 5, initialDelayMs = 1_000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (npmPackageVersionExists(packageName, version)) {
      return true;
    }

    if (attempt < attempts) {
      const delayMs = initialDelayMs * (2 ** (attempt - 1));
      console.log(
        `[publish] ${packageName}@${version} is not visible on npm yet; retrying in ${delayMs}ms (${attempt}/${attempts}).`,
      );
      await sleep(delayMs);
    }
  }

  return false;
}

function withTokenFallbackEnvironment(workspaceRoot, preservedNodeAuthToken, fn) {
  const previousNodeAuthToken = process.env.NODE_AUTH_TOKEN;
  const previousUserConfig = process.env.NPM_CONFIG_USERCONFIG;

  process.env.NODE_AUTH_TOKEN = preservedNodeAuthToken;
  process.env.NPM_CONFIG_USERCONFIG = ensureTokenUserConfig(workspaceRoot);

  try {
    return fn();
  } finally {
    if (previousNodeAuthToken === undefined) {
      delete process.env.NODE_AUTH_TOKEN;
    } else {
      process.env.NODE_AUTH_TOKEN = previousNodeAuthToken;
    }

    if (previousUserConfig === undefined) {
      delete process.env.NPM_CONFIG_USERCONFIG;
    } else {
      process.env.NPM_CONFIG_USERCONFIG = previousUserConfig;
    }
  }
}

function npmPackageExists(packageName) {
  const result = spawnSync(NPM, ["view", "--registry", NPM_PUBLIC_REGISTRY, packageName, "version"], {
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
      `[publish] npm view failed for ${packageName} (exit=${result.status ?? "unknown"})`,
      snippet ? `---\n${snippet}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function readPackedPackageJson(tarballPath) {
  const { stdout } = runWithOutput(TAR, ["-xOf", tarballPath, "package/package.json"]);
  return JSON.parse(stdout);
}

function readPackageReleaseMetadata(pkg) {
  const packageJsonPath = typeof pkg?.publishSource === "string" && pkg.publishSource.endsWith(".tgz")
    ? pkg.publishSource
    : path.join(pkg.dir, "package.json");
  let packageJson;
  try {
    packageJson = packageJsonPath.endsWith(".tgz")
      ? readPackedPackageJson(packageJsonPath)
      : JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[publish] failed to read release metadata from ${packageJsonPath}: ${message}`);
  }

  return {
    deprecationMessage: typeof packageJson?.rawsqlTs?.deprecationMessage === "string"
      ? packageJson.rawsqlTs.deprecationMessage.trim()
      : "",
  };
}

function publishWithNpm(publishTarget, publishAuth, opts) {
  // CI already builds publish artifacts up front, so skip lifecycle rebuilds during npm publish.
  const args = ["publish"];
  if (publishTarget) {
    args.push(publishTarget);
  }
  args.push("--ignore-scripts", "--registry", NPM_PUBLIC_REGISTRY, "--access", "public");

  if (publishAuth === "oidc") {
    // OIDC Trusted Publishing requires provenance.
    args.push("--provenance");
  }

  try {
    runWithOutput(NPM, args, { cwd: opts?.cwd });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const c = classifyNpmFailure(message);

    if (publishAuth === "oidc") {
      if (opts?.packageName && (c.needAuth || c.e401 || c.e403 || c.e404)) {
        // Add extra context that can be correlated with Trusted Publisher settings in npm.
        logNpmViewDiagnostics(opts.packageName);
      }

      const canFallback =
        opts?.allowTokenFallback === true && Boolean(opts?.preservedNodeAuthToken) && Boolean(opts?.workspaceRoot);

      const reasons = [];
      if (c.needAuth) reasons.push("ENEEDAUTH (npm thinks you are not logged in)");
      if (c.e401) reasons.push("E401 Unauthorized");
      if (c.e403) reasons.push("E403 Forbidden");
      if (c.e404) reasons.push("E404 Not Found (sometimes permission/auth is masked as 404)");

      if (canFallback && (c.needAuth || c.e401 || c.e403 || c.e404)) {
        // OIDC can fail if Trusted Publishers isn't configured or the workflow context doesn't match.
        // When allowed, retry with token auth so releases aren't blocked.
        console.warn("[publish] OIDC publish failed; retrying with token auth fallback.");

        try {
          withTokenFallbackEnvironment(opts.workspaceRoot, opts.preservedNodeAuthToken, () => {
            const fallbackArgs = ["publish"];
            if (publishTarget) {
              fallbackArgs.push(publishTarget);
            }
            fallbackArgs.push("--ignore-scripts", "--registry", NPM_PUBLIC_REGISTRY, "--access", "public");
            runWithOutput(NPM, fallbackArgs, { cwd: opts?.cwd });
          });
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
        "  0) see docs/oidc-publish-troubleshooting.md in this repo",
        "  1) npm Trusted Publisher is configured for THIS package and THIS workflow file in THIS repo",
        "  2) workflow permissions include: id-token: write",
        "  3) NODE_AUTH_TOKEN is NOT set anywhere (env, secrets, org vars)",
        `  4) npm >= 11.5.1 and registry is ${NPM_PUBLIC_REGISTRY}`,
        "  5) npm publish includes --provenance (this script adds it in oidc mode)",
        opts?.allowTokenFallback === true
          ? `  6) (fallback enabled) ensure a valid ${FALLBACK_TOKEN_ENV} or NODE_AUTH_TOKEN is available for token auth retry`
          : `  6) (optional) enable RAWSQL_PUBLISH_OIDC_FALLBACK_TO_TOKEN=1 and provide ${FALLBACK_TOKEN_ENV} for token retry`,
      ].join("\n");

      throw new Error([hint, `---\n${message}`].join("\n"));
    }

    throw error;
  }
}

function deprecateWithNpm(packageSpec, message, publishAuth, opts) {
  const args = ["deprecate", "--registry", NPM_PUBLIC_REGISTRY, packageSpec, message];

  try {
    runWithOutput(NPM, args, { cwd: opts?.cwd });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    const c = classifyNpmFailure(messageText);

    if (publishAuth === "oidc") {
      const canFallback =
        opts?.allowTokenFallback === true && Boolean(opts?.preservedNodeAuthToken) && Boolean(opts?.workspaceRoot);

      if (canFallback && (c.needAuth || c.e401 || c.e403 || c.e404)) {
        console.warn(`[publish] OIDC deprecate failed for ${packageSpec}; retrying with token auth fallback.`);
        withTokenFallbackEnvironment(opts.workspaceRoot, opts.preservedNodeAuthToken, () => {
          const fallbackArgs = ["deprecate", "--registry", NPM_PUBLIC_REGISTRY, packageSpec, message];
          runWithOutput(NPM, fallbackArgs, { cwd: opts?.cwd });
        });
        return;
      }

      throw new Error(
        [
          `[publish] npm deprecate failed for ${packageSpec} (OIDC mode).`,
          "Ensure the publish credentials also have rights to manage package deprecations.",
          `---\n${messageText}`,
        ].join("\n"),
      );
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

async function main() {
  const workspaceRoot = process.cwd();
  const dryRun = process.env.RAWSQL_CI_DRY_RUN === "1";
  const publishAuth = detectPublishAuth();

  // Keep actual publish self-diagnosing even when invoked outside the intended workflow wrapper.
  for (const command of [NPM, GIT, GH]) {
    ensureCommandAvailable(command);
  }

  const preservedNodeAuthToken = getPreservedPublishToken();
  const allowTokenFallback = process.env.RAWSQL_PUBLISH_OIDC_FALLBACK_TO_TOKEN === "1";

  sanitizeOidcEnvironment(publishAuth, workspaceRoot);
  logOidcEnvironment(publishAuth);
  logNpmAuthDiagnostics(publishAuth);
  await logOidcTokenClaims(publishAuth);
  ensureOidcPrereqs(publishAuth);

  const packages = loadPublishManifest(workspaceRoot);

  const tmpNotesDir = path.join(workspaceRoot, "tmp", "release-notes");
  ensureDir(tmpNotesDir);

  const publishablePackages = [];
  const skippedUnpublishedPackages = [];
  for (const pkg of packages) {
    // The manual CI workflow can update existing npm packages, but first-time package creation
    // may still require out-of-band registry setup/permissions. Skip those packages here.
    const existsOnRegistry = npmPackageExists(pkg.name);
    if (!existsOnRegistry) {
      skippedUnpublishedPackages.push(`${pkg.name}@${pkg.version}`);
      console.log(`[publish] ${pkg.name} is not registered on npm yet; skipping from manual CI publish`);
      continue;
    }
    publishablePackages.push(pkg);
  }

  const packageReleaseMetadata = new Map(
    publishablePackages.map((pkg) => [pkg.name, readPackageReleaseMetadata(pkg)]),
  );

  const publishedNow = [];
  const releaseErrors = [];

  // Publish packages
  for (const pkg of publishablePackages) {
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
    publishWithNpm(pkg.publishSource ?? null, publishAuth, {
      cwd: pkg.publishCwd ?? pkg.dir,
      packageName: pkg.name,
      allowTokenFallback,
      preservedNodeAuthToken,
      workspaceRoot,
    });
    publishedNow.push(`${pkg.name}@${pkg.version}`);
  }

  for (const pkg of publishablePackages) {
    if (dryRun) {
      const deprecationMessage = packageReleaseMetadata.get(pkg.name)?.deprecationMessage ?? "";
      if (deprecationMessage) {
        console.log(`[publish] (dry-run) would deprecate ${pkg.name}@${pkg.version}`);
      }
      continue;
    }

    const deprecationMessage = packageReleaseMetadata.get(pkg.name)?.deprecationMessage ?? "";
    if (!deprecationMessage) {
      continue;
    }

    const versionExists = await waitForPackageVersion(pkg.name, pkg.version);
    if (!versionExists) {
      console.warn(`[publish] skipping deprecate for ${pkg.name}@${pkg.version}; version is still not visible on npm after retries.`);
      continue;
    }

    console.log(`[publish] deprecating ${pkg.name}@${pkg.version}`);
    deprecateWithNpm(`${pkg.name}@${pkg.version}`, deprecationMessage, publishAuth, {
      cwd: pkg.publishCwd ?? pkg.dir,
      allowTokenFallback,
      preservedNodeAuthToken,
      workspaceRoot,
    });
  }

  // Create tags
  for (const pkg of publishablePackages) {
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
  for (const pkg of publishablePackages) {
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

  if (skippedUnpublishedPackages.length > 0) {
    console.log(`[publish] skipped packages not yet registered on npm: ${skippedUnpublishedPackages.join(", ")}`);
  }

  if (releaseErrors.length > 0) {
    console.log(`[release] completed with ${releaseErrors.length} error(s).`);
    console.log(
      "[release] To fail the workflow on release errors, set RAWSQL_FAIL_ON_RELEASE_ERROR=1.",
    );
  }
}

await main();
