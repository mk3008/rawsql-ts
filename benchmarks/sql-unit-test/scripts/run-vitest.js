const { spawnSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join, resolve } = require('node:path')

const benchRoot = resolve(__dirname, '..')
const generatedPath = join(benchRoot, 'tests', 'generated', 'ztd-row-map.generated.ts')

if (!existsSync(generatedPath)) {
  console.log('Skipping benchmark tests because generated fixtures are missing.')
  console.log(
    'Run `cd benchmarks/sql-unit-test`, then `npx ztd ztd-config`, and after generation rerun `pnpm bench:test`.'
  )
  process.exit(0)
}

const result = spawnSync('vitest', [], {
  cwd: benchRoot,
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status === null ? 1 : result.status)
