const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const coreDist = path.join(workspaceRoot, "packages", "core", "dist");
const lockDir = path.join(workspaceRoot, "tmp", "sync-rawsql-dist.lock");
const lockMetaPath = path.join(lockDir, "owner.json");
const STALE_LOCK_MS = 60_000;

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

function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withLock(run) {
    fs.mkdirSync(path.dirname(lockDir), { recursive: true });

    for (let attempt = 0; attempt < 200; attempt += 1) {
        try {
            fs.mkdirSync(lockDir);
            fs.writeFileSync(lockMetaPath, JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
            try {
                return run();
            } finally {
                fs.rmSync(lockDir, { recursive: true, force: true });
            }
        } catch (error) {
            if (error && error.code === "EEXIST") {
                releaseStaleLock();
                sleep(50);
                continue;
            }

            throw error;
        }
    }

    throw new Error("[sync-rawsql-dist] Timed out waiting for sync lock.");
}

function releaseStaleLock() {
    try {
        const meta = JSON.parse(fs.readFileSync(lockMetaPath, "utf8"));
        const createdAt = typeof meta.createdAt === "number" ? meta.createdAt : 0;
        const pid = typeof meta.pid === "number" ? meta.pid : null;
        const isExpired = Date.now() - createdAt > STALE_LOCK_MS;
        const ownerMissing = pid === null || !processExists(pid);

        if (isExpired || ownerMissing) {
            fs.rmSync(lockDir, { recursive: true, force: true });
        }
    } catch {
        fs.rmSync(lockDir, { recursive: true, force: true });
    }
}

function processExists(pid) {
    if (process.platform === "win32") {
        return true;
    }

    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

withLock(() => {
    for (const entry of candidateDirs) {
        const dest = path.join(pnpmStoreDir, entry, "node_modules", "rawsql-ts", "dist");
        fs.rmSync(dest, { recursive: true, force: true });
        fs.cpSync(coreDist, dest, { recursive: true });
    }
});