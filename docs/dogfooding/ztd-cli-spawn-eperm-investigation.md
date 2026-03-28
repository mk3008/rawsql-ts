# ztd-cli spawn EPERM Investigation

### Source issue
Issue #685

### Why blocker
`pnpm --filter @rawsql-ts/ztd-cli test` is part of the required verification path for the customer-facing Codex bootstrap added in Issue #685. If the test entrypoint cannot start in a reviewer-visible environment, acceptance items 1-3 cannot be promoted to `done` because the PR would otherwise claim verification that did not actually happen.

### Reproduction
- command: `pnpm --filter @rawsql-ts/ztd-cli test`
- working directory: `<repo-root>`
- environment:
  - OS: `Microsoft Windows [Version 10.0.26200.8037]`
  - shell: `Windows PowerShell 5.1.26100.7920`
  - Node: `v22.16.0`
  - pnpm: `10.17.0`
  - Vitest: `4.0.7`
  - esbuild: `0.25.10`
- full error:

```text
> @rawsql-ts/ztd-cli@0.22.5 test <repo-root>\packages\ztd-cli
> pnpm --filter @rawsql-ts/adapter-node-pg run build && vitest run --config vitest.config.ts

failed to load config from <repo-root>\packages\ztd-cli\vitest.config.ts

Startup Error
Error: spawn EPERM
    at ChildProcess.spawn (node:internal/child_process:420:11)
    at Object.spawn (node:child_process:753:9)
    at ensureServiceIsRunning (<repo-root>\node_modules\.pnpm\esbuild@0.25.10\node_modules\esbuild\lib\main.js:1978:29)
    at build (<repo-root>\node_modules\.pnpm\esbuild@0.25.10\node_modules\esbuild\lib\main.js:1876:26)
    at bundleConfigFile (file:///<repo-root>/node_modules/.pnpm/vite@7.2.1_@types+node@22.18.7_jiti@2.6.1_yaml@2.8.3/node_modules/vite/dist/node/chunks/config.js:36419:23)
    at bundleAndLoadConfigFile (file:///<repo-root>/node_modules/.pnpm/vite@7.2.1_@types+node@22.18.7_jiti@2.6.1_yaml@2.8.3/node_modules/vite/dist/node/chunks/config.js:36406:24)
    at loadConfigFromFile (file:///<repo-root>/node_modules/.pnpm/vite@7.2.1_@types+node@22.18.7_jiti@2.6.1_yaml@2.8.3/node_modules/vite/dist/node/chunks/config.js:36375:179)
    at resolveConfig (file:///<repo-root>/node_modules/.pnpm/vite@7.2.1_@types+node@22.18.7_jiti@2.6.1_yaml@2.8.3/node_modules/vite/dist/node/chunks/config.js:36024:28)
    at _createServer (file:///<repo-root>/node_modules/.pnpm/vite@7.2.1_@types+node@22.18.7_jiti@2.6.1_yaml@2.8.3/node_modules/vite/dist/node/chunks/config.js:25969:73)
    at createServer$2 (file:///<repo-root>/node_modules/.pnpm/vite@7.2.1_@types+node@22.18.7_jiti@2.6.1_yaml@2.8.3/node_modules/vite/dist/node/chunks/config.js:25966:9) {
  errno: -4048,
  code: 'EPERM',
  syscall: 'spawn'
}
```

- first failing spawn target:

```text
SPAWN_TARGET=<repo-root>\node_modules\.pnpm\@esbuild+win32-x64@0.25.10\node_modules\@esbuild\win32-x64\esbuild.exe
SPAWN_ARGS=["--service=0.25.10","--ping"]
SPAWN_CWD=<repo-root>
```

### Investigation steps
- step 1:
  - Reproduced the failure with:
    - `pnpm --filter @rawsql-ts/ztd-cli test`
    - `pnpm --filter @rawsql-ts/ztd-cli exec vitest`
    - `pnpm --filter @rawsql-ts/ztd-cli test -- --run tests/utils/agents.test.ts`
    - `pnpm --filter @rawsql-ts/ztd-cli exec vitest run tests/utils/agents.test.ts`
  - Every variant failed before any test file was collected, while loading `vitest.config.ts`.
- step 2:
  - Compared adjacent commands:
    - `pnpm --filter @rawsql-ts/ztd-cli build` -> passed
    - `pnpm --filter @rawsql-ts/ztd-cli lint` -> passed
    - `pnpm --filter @rawsql-ts/ztd-cli exec vitest run --config vitest.config.ts --configLoader runner` -> still failed with `spawn EPERM`
  - The `--configLoader runner` path changed the stack from esbuild service startup to Vite path-resolution internals, but it still failed in `child_process` before tests started.
- step 3:
  - Isolated the problem below the repo test layer:
    - PowerShell can run `esbuild.exe --version` directly.
    - A minimal Node script that only does `child_process.spawn('cmd.exe', ...)` fails with `EPERM`.
    - A minimal Node script that only does `child_process.spawn(process.execPath, ['-v'])` fails with `EPERM`.
    - A minimal Node script that only does `require('esbuild').build(...)` fails with `EPERM` while spawning `esbuild.exe --service=0.25.10 --ping`.
    - Copying `esbuild.exe` to `<workspace>/tmp-short/esbuild-copy.exe` does not help; Node spawn still fails with `EPERM`.
    - Running through `cmd.exe` instead of PowerShell does not help; `pnpm ... exec vitest` still fails the same way.
  - A short-path junction `<workspace>/rawsql-ts-short` did not change the result.
  - Testing with a workdir outside OneDrive was not possible in this sandbox because command setup failed when the shell workdir moved outside the writable roots.

### Findings
- confirmed:
  - `pnpm --filter @rawsql-ts/ztd-cli test` fails reproducibly in this environment with `spawn EPERM`.
  - The failure happens before any Issue #685 test file or snapshot is executed.
  - `build` and `lint` pass in the same environment.
  - `pnpm --filter @rawsql-ts/ztd-cli exec vitest` fails the same way as the package `test` script.
  - `pnpm --filter @rawsql-ts/ztd-cli test -- --run tests/utils/agents.test.ts` still fails before single-test selection matters.
  - `--configLoader runner` does not unblock the run; the failure is broader than esbuild config bundling.
  - Minimal Node `child_process.spawn()` and `spawnSync()` calls fail even for `cmd.exe` and `node.exe`.
  - Direct shell execution of `esbuild.exe` works, so the failure is specifically on Node-launched subprocesses in this environment.
- not confirmed:
  - Whether the same Node spawn failure reproduces outside OneDrive on this machine.
  - Whether CI or another Windows environment without this sandbox reproduces the same behavior.
  - Whether Windows Defender / Controlled Folder Access is the exact policy component involved.
- ruled out:
  - A problem unique to the new Issue #685 tests or snapshots.
  - A problem unique to `pnpm --filter @rawsql-ts/ztd-cli test` script wiring.
  - A problem unique to PowerShell vs `cmd.exe`.
  - A simple temp-directory-length issue inside the repo; overriding `TEMP` and `TMP` to `tmp-short` did not change the result.
- still unknown:
  - The exact host policy or runtime restriction that blocks Node child-process creation in this session.
  - Whether the root cause is Codex desktop sandboxing, Windows security policy, or another local execution control layer.

### Conclusion
B. This PR's code changes are not the primary cause. The blocker is environment-dependent and happens below the repo test layer because Node cannot spawn even `cmd.exe` or `node.exe` from a minimal script in this session. Additional confirmation in CI or another local environment is still required before calling the test path healthy.

### Impact on acceptance items
- acceptance item 1:
  - status: `partial`
  - reason: the bootstrap implementation exists and direct CLI checks passed, but the required `pnpm --filter @rawsql-ts/ztd-cli test` path is blocked by environment-level `spawn EPERM`.
- acceptance item 2:
  - status: `partial`
  - reason: the code path is implemented and repo evidence exists, but the test suite that should verify the opt-in boundary is still blocked.
- acceptance item 3:
  - status: `partial`
  - reason: collision/customization handling is implemented, but the unit tests that should prove it remain blocked by the same startup failure.

### What should happen next
- fix inside this PR: not yet. The current evidence does not justify changing the Issue #685 implementation to address `spawn EPERM`.
- split into a separate issue: yes, if CI or another local environment confirms that the PR code is healthy while this environment continues to block Node subprocesses.
- continue with CI or another environment: yes. The next decision point should be a reviewer-checkable run in CI or a second Windows environment that can execute Node child processes normally.

### Reviewer conclusion
- Local Windows environment reproduces `spawn EPERM` below the Issue #685 change layer.
- Current evidence is insufficient to mark acceptance items 1-3 as done.
- Next decision depends on CI or alternate-environment verification.
