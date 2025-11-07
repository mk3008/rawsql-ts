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

const download = () =>
  new Promise((resolve, reject) => {
    const file = fs.createWriteStream(archivePath);
    https
      .get(downloadUrl, (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`Failed to download prebuilt binary (${response.statusCode})`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
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

  const prebuildRelease = path.join(tmpDir, 'build', 'Release', 'better_sqlite3.node');
  if (!fs.existsSync(prebuildRelease)) {
    console.warn('[better-sqlite3-prebuild] Extracted archive does not contain build/Release/better_sqlite3.node');
    process.exit(0);
  }

  fs.mkdirSync(bindingDir, { recursive: true });
  fs.mkdirSync(releaseDir, { recursive: true });
  fs.copyFileSync(prebuildRelease, bindingFile);
  fs.copyFileSync(prebuildRelease, path.join(releaseDir, 'better_sqlite3.node'));
  console.log(`[better-sqlite3-prebuild] Installed ${assetName}`);
})();
