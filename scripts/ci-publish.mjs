#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const IS_WINDOWS = process.platform === "win32";
const PNPM = "pnpm";
const NPM = "npm";
const GIT = "git";
const GH = "gh";

function run(command, args, options = {}) {
  // Use sync execution to keep CI logs ordered and failures deterministic.
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: IS_WINDOWS,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function tryRun(command, args, options = {}) {
  // Best-effort command probe; callers decide how to interpret failures.
  const result = spawnSync(command, args, {
    stdio: "ignore",
    shell: IS_WINDOWS,
    ...options,
  });

  if (result.error) {
    return { ok: false, status: null };
  }
  return { ok: result.status === 0, status: result.status };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  // Create the directory only when needed to avoid touching the working tree unexpectedly.
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getFixedPackageNames(workspaceRoot) {
  const configPath = path.join(workspaceRoot, ".changeset", "config.json");
  const config = readJson(configPath);

  // The repo uses a fixed group, so we treat the first entry as the publish set.
  const fixedGroups = Array.isArray(config.fixed) ? config.fixed : [];
  const fixedGroup = fixedGroups[0];
  if (!Array.isArray(fixedGroup) || fixedGroup.length === 0) {
    throw new Error(`No fixed group found in ${configPath}`);
  }
  return fixedGroup;
}

function getWorkspacePackageDirByName() {
  // Use pnpm itself to resolve workspace package locations reliably.
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
  // Prefer explicit auth selection to avoid implicit behavior changes across CI environments.
  const raw = process.env.RAWSQL_PUBLISH_AUTH;
  if (raw === "oidc" || raw === "token") {
    console.log(`[publish] auth=${raw} (source=RAWSQL_PUBLISH_AUTH)`);
    return raw;
  }

  // Backward-compatible default: token when NODE_AUTH_TOKEN exists, otherwise oidc.
  const fallback = process.env.NODE_AUTH_TOKEN ? "token" : "oidc";
  console.log(`[publish] auth=${fallback} (source=default:${process.env.NODE_AUTH_TOKEN ? "NODE_AUTH_TOKEN" : "no-token"})`);
  return fallback;
}

function npmPackageVersionExists(packageName, version) {
  // Public registry lookup; this should not require any credentials.
  // Treat only "not found" (404) as "doesn't exist"; other failures should stop the publish.
  const result = spawnSync(NPM, ["view", `${packageName}@${version}`, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WINDOWS,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    return true;
  }

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const looksLike404 = /\bE404\b/i.test(combined) || /\b404\b.*\bNot Found\b/i.test(combined) || /\bnpm ERR!\s*404\b/i.test(combined);
  if (looksLike404) {
    return false;
  }

  // Preserve enough context for debugging while avoiding huge log spam.
  const snippet = combined.trim().split(/\r?\n/).slice(-25).join("\n");
  throw new Error(
    [
      `[publish] npm view failed for ${packageName}@${version} (exit=${result.status ?? "unknown"})`,
      snippet ? `---\n${snippet}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function publishWithNpm(packageDir, publishAuth) {
  const args = ["publish", "--access", "public"];

  // When publishing via npm Trusted Publishing (OIDC), npm requires --provenance.
  // Do not infer auth from NODE_AUTH_TOKEN; auth is selected explicitly by RAWSQL_PUBLISH_AUTH.
  if (publishAuth === "oidc") {
    args.push("--provenance");
  }

  run(NPM, args, { cwd: packageDir });
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

  // Trim leading/trailing empty lines to keep notes compact.
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
  const fixedPackageNames = getFixedPackageNames(workspaceRoot);
  const dirByName = getWorkspacePackageDirByName();

  const tmpNotesDir = path.join(workspaceRoot, "tmp", "release-notes");
  ensureDir(tmpNotesDir);

  const packages = [];
  for (const packageName of fixedPackageNames) {
    const packageDir = dirByName.get(packageName);
    if (!packageDir) {
      throw new Error(`Workspace package directory not found for "${packageName}"`);
    }

    const pkgJsonPath = path.join(packageDir, "package.json");
    const pkg = readJson(pkgJsonPath);
    if (pkg.private) {
      continue;
    }

    packages.push({
      name: pkg.name,
      version: pkg.version,
      dir: packageDir,
      changelogPath: path.join(packageDir, "CHANGELOG.md"),
    });
  }

  const publishedNow = [];
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
    publishWithNpm(pkg.dir, publishAuth);
    publishedNow.push(`${pkg.name}@${pkg.version}`);
  }

  // Create tags for the current versions so GitHub releases can attach to them.
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

  // Push tags so releases can be created on the remote.
  if (!dryRun) {
    pushAllTags();
  } else {
    console.log("[tag] (dry-run) would push tags");
  }

  // Create GitHub releases per package/tag, using the package CHANGELOG section when available.
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
      if (section) {
        // Use the version section as release notes to stay aligned with Changesets output.
        notes = section;
      }
    }

    const notesFile = path.join(tmpNotesDir, `${sanitizeFilename(tagName)}.md`);
    fs.writeFileSync(notesFile, notes, "utf8");

    console.log(`[release] creating ${tagName}`);
    createGitHubRelease(tagName, notesFile);
  }

  if (publishedNow.length === 0) {
    console.log("[publish] no packages were published (all versions already exist)");
  } else {
    console.log(`[publish] published: ${publishedNow.join(", ")}`);
  }
}

main();
