param(
  [string]$Case = "crud-basic",
  [string]$Scenario = "crud-basic",
  [int]$Loop = 0,
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

$entry = if ($Loop -gt 0) { Join-Path $repoRoot "eval/loop.ts" } else { Join-Path $repoRoot "eval/runner.ts" }
$args = @($entry)

if ($Loop -gt 0) {
  $args += @("--loop", "$Loop", "--scenario", $Scenario, "--report-prefix", "eval/reports/loop")
  if ($KeepWorkspace) { $args += "--keep-workspace" }
} else {
  $args += @("--case", $Case, "--scenario", $Scenario, "--report", $Report)
  if ($KeepWorkspace) { $args += "--keep-workspace" }
  if ($SkipAi) { $args += "--skip-ai" }
}

pnpm exec ts-node @args
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$cleanupScript = Join-Path $repoRoot "eval/cleanup-workspaces.ps1"
$cleanupArgs = @("-Root", $workspaceRoot, "-KeepLast", "3", "-MaxAgeDays", "7")

try {
  & "$cleanupScript" @cleanupArgs "-DryRun"
} catch {
  Write-Warning "Workspace cleanup dry run failed: $($_.Exception.Message)"
}

try {
  & "$cleanupScript" @cleanupArgs "-Force" "-DryRun:$false"
} catch {
  Write-Warning "Workspace cleanup execution failed: $($_.Exception.Message)"
}
