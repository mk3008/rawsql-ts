param(
  [string]$Root = (Join-Path $HOME "_ztd_eval/workspaces"),
  [int]$KeepLast = 3,
  [int]$MaxAgeDays = 7,
  [bool]$DryRun = $true,
  [switch]$Force,
  [switch]$ForceRootOverride
)
$ErrorActionPreference = "Stop"

function Format-Size($bytes) {
  if ($bytes -ge 1TB) { return "{0:N1} TB" -f ($bytes / 1TB) }
  if ($bytes -ge 1GB) { return "{0:N1} GB" -f ($bytes / 1GB) }
  if ($bytes -ge 1MB) { return "{0:N1} MB" -f ($bytes / 1MB) }
  if ($bytes -ge 1KB) { return "{0:N1} KB" -f ($bytes / 1KB) }
  return "${bytes} B"
}

function Ensure-ValidRoot($path) {
  $resolved = Resolve-Path -LiteralPath $path -ErrorAction Stop
  $absoluteRoot = $resolved.ProviderPath
  if (-not $ForceRootOverride) {
    if (-not ($absoluteRoot -match "\\_ztd_eval\\.*\\workspaces$" -or $absoluteRoot -like "*_ztd_eval*\\workspaces")) {
      throw "Refusing to operate outside a `_ztd_eval`/`workspaces` tree unless `-ForceRootOverride` is provided."
    }
  }
  if ($absoluteRoot -eq [IO.Path]::GetPathRoot($absoluteRoot)) {
    throw "Refusing to operate on a drive root."
  }
  return $absoluteRoot
}

$absoluteRoot = Ensure-ValidRoot $Root

$directories = Get-ChildItem -LiteralPath $absoluteRoot -Directory -Force -ErrorAction SilentlyContinue |
  Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) }

if (-not $directories) {
  Write-Output "No workspaces found under $absoluteRoot."
  return
}

$sortedDirs = $directories | Sort-Object LastWriteTime -Descending
$keptNewest = $sortedDirs | Select-Object -First $KeepLast
$rest = $sortedDirs | Select-Object -Skip $KeepLast
$now = Get-Date

$keptRecent = @()
$deleteCandidates = @()
foreach ($dir in $rest) {
  $ageDays = ($now - $dir.LastWriteTime).TotalDays
  if ($ageDays -ge $MaxAgeDays) {
    $deleteCandidates += $dir
  } else {
    $keptRecent += $dir
  }
}

$deleteSize = 0
foreach ($dir in $deleteCandidates) {
  $size = (Get-ChildItem -LiteralPath $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum
  $deleteSize += $size
}

Write-Output "Workspace cleanup report for $absoluteRoot"
Write-Output "- keep newest ($KeepLast):"
foreach ($dir in $keptNewest) { Write-Output "  $($dir.Name)" }
Write-Output "- keep recent (age < $MaxAgeDays days):"
foreach ($dir in $keptRecent) { Write-Output "  $($dir.Name) (updated $($dir.LastWriteTime))" }
Write-Output "- delete candidates ($($deleteCandidates.Count)) - approx reclaim: $(Format-Size $deleteSize)"
foreach ($dir in $deleteCandidates) { Write-Output "  $($dir.Name) (age $([math]::Round(($now - $dir.LastWriteTime).TotalDays, 1))d)" }

if ($DryRun -and -not $Force) {
  Write-Output "Dry run: no directories deleted."
  return
}

if (-not $Force) {
  $dryText = if ($DryRun) { "false" } else { "true" }
  throw "Must specify -Force and -DryRun:$dryText to delete directories."
}

if ($DryRun -eq $true) {
  throw "Cannot delete while DryRun is still enabled."
}

$deletionResults = @()
foreach ($dir in $deleteCandidates) {
  try {
    Remove-Item -LiteralPath $dir.FullName -Recurse -Force -ErrorAction Stop
    $deletionResults += "Deleted $($dir.FullName)"
  } catch {
    $deletionResults += "Failed to delete $($dir.FullName): $($_.Exception.Message)"
  }
}

foreach ($entry in $deletionResults) { Write-Output $entry }
