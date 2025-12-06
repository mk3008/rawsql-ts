const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const coreDist = path.join(workspaceRoot, "packages", "core", "dist");

if (!fs.existsSync(coreDist)) {
    console.warn("[sync-rawsql-dist] packages/core/dist is not available; skipping sync.");
    process.exit(0);
}

const corePackage = require(path.join(workspaceRoot, "packages", "core", "package.json"));
const pnpmStoreDir = path.join(workspaceRoot, "node_modules", ".pnpm");

if (!fs.existsSync(pnpmStoreDir)) {
    console.warn("[sync-rawsql-dist] pnpm store directory is missing; skipping sync.");
    process.exit(0);
}

const candidateDirs = fs
    .readdirSync(pnpmStoreDir)
    .filter((entry) => entry.startsWith(`rawsql-ts@${corePackage.version}`));

if (candidateDirs.length === 0) {
    console.warn("[sync-rawsql-dist] No rawsql-ts store entry found; skipping sync.");
    process.exit(0);
}

for (const entry of candidateDirs) {
    const dest = path.join(pnpmStoreDir, entry, "node_modules", "rawsql-ts", "dist");
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(coreDist, dest, { recursive: true });
}
