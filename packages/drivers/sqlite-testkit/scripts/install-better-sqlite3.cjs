#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const { spawnSync } = require('node:child_process');

const packageRoot = path.resolve(__dirname, '..');
let pkgJsonPath;
try {
  pkgJsonPath = require.resolve('better-sqlite3/package.json', { paths: [packageRoot] });
} catch (error) {
  console.warn('[better-sqlite3-prebuild] better-sqlite3 is not installed yet.');
  process.exit(0);
}

const betterRoot = path.dirname(pkgJsonPath);
const betterPkg = require(pkgJsonPath);
const version = betterPkg.version;
const abi = process.versions.modules;
const platform = process.platform;
const arch = process.arch;
const bindingDir = path.join(betterRoot, 'lib', 'binding', `node-v${abi}-${platform}-${arch}`);
const releaseDir = path.join(betterRoot, 'build', 'Release');
const bindingFile = path.join(bindingDir, 'better_sqlite3.node');

if (fs.existsSync(bindingFile)) {
  process.exit(0);
}

const assetName = `better-sqlite3-v${version}-node-v${abi}-${platform}-${arch}.tar.gz`;
const downloadUrl = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${version}/${assetName}`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-sqlite3-'));
const archivePath = path.join(tmpDir, assetName);

const download = (url = downloadUrl, redirectCount = 0) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          // Follow GitHub's redirector (a HEAD object would yield a 302 first).
          if (redirectCount >= 5) {
            reject(new Error('Too many redirects while downloading prebuilt binary'));
            return;
          }
          response.resume();
          download(response.headers.location, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`Failed to download prebuilt binary (${response.statusCode})`));
          response.resume();
          return;
        }

        // Stream the payload into the archive path once we have a 200 response.
        const file = fs.createWriteStream(archivePath);
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
        file.on('error', reject);
      })
      .on('error', reject);
  });

(async () => {
  try {
    await download();
  } catch (error) {
    console.warn(`[better-sqlite3-prebuild] ${error.message}`);
    process.exit(0);
  }

  const extractResult = spawnSync('tar', ['-xzf', archivePath, '-C', tmpDir], {
    stdio: 'inherit',
  });

  if (extractResult.status !== 0) {
    console.warn('[better-sqlite3-prebuild] Failed to extract archive, skipping.');
    process.exit(0);
  }

  const locatePrebuilt = (searchDir) => {
    // Depth-first search so we can handle archives that wrap binaries with additional folders.
    for (const entry of fs.readdirSync(searchDir, { withFileTypes: true })) {
      const fullPath = path.join(searchDir, entry.name);
      if (entry.isDirectory()) {
        const nested = locatePrebuilt(fullPath);
        if (nested) {
          return nested;
        }
      } else if (entry.isFile() && entry.name === 'better_sqlite3.node') {
        return fullPath;
      }
    }
    return undefined;
  };

  const prebuildRelease = locatePrebuilt(tmpDir);
  if (!prebuildRelease) {
    console.warn('[better-sqlite3-prebuild] Extracted archive did not contain better_sqlite3.node');
    process.exit(0);
  }

  fs.mkdirSync(bindingDir, { recursive: true });
  fs.mkdirSync(releaseDir, { recursive: true });
  fs.copyFileSync(prebuildRelease, bindingFile);
  fs.copyFileSync(prebuildRelease, path.join(releaseDir, 'better_sqlite3.node'));
  console.log(`[better-sqlite3-prebuild] Installed ${assetName}`);
})();
