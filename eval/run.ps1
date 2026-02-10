param(
  [string]$Case = "crud-basic",
  [switch]$KeepWorkspace,
  [switch]$SkipAi,
  [string]$Report = "eval/reports/latest.json"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$workspaceRoot = if ($env:EVAL_WORKSPACE_ROOT) { $env:EVAL_WORKSPACE_ROOT } else { Join-Path $HOME "_ztd_eval/workspaces" }
$codexHome = if ($env:EVAL_CODEX_HOME) { $env:EVAL_CODEX_HOME } else { Join-Path $workspaceRoot "_codex_home" }

$env:EVAL_WORKSPACE_ROOT = $workspaceRoot
$env:EVAL_CODEX_HOME = $codexHome
$env:CODEX_HOME = $codexHome

if (-not (Test-Path $codexHome)) {
  New-Item -ItemType Directory -Path $codexHome -Force | Out-Null
}

$runner = Join-Path $repoRoot "eval/runner.ts"
$args = @($runner, "--case", $Case, "--report", $Report)
if ($KeepWorkspace) { $args += "--keep-workspace" }
if ($SkipAi) { $args += "--skip-ai" }

pnpm exec ts-node @args
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
