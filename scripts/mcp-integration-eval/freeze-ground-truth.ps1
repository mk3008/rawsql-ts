$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$dev = Join-Path $PSScriptRoot 'scenarios.dev.json'
$holdout = Join-Path $repoRoot 'tmp\mcp-integration-eval\holdout\scenarios.json'
if (-not (Test-Path -LiteralPath $holdout)) { throw "Generate holdout scenarios first: $holdout" }
$manifest = [ordered]@{
  schemaVersion = 1
  frozenAtUtc = [DateTime]::UtcNow.ToString('o')
  gitHead = (git -C $repoRoot rev-parse HEAD).Trim()
  dev = [ordered]@{ path = 'scripts/mcp-integration-eval/scenarios.dev.json'; sha256 = (Get-FileHash -Algorithm SHA256 $dev).Hash.ToLowerInvariant() }
  holdout = [ordered]@{ path = 'tmp/mcp-integration-eval/holdout/scenarios.json'; sha256 = (Get-FileHash -Algorithm SHA256 $holdout).Hash.ToLowerInvariant() }
}
$out = Join-Path $repoRoot 'tmp\mcp-integration-eval\ground-truth-freeze.json'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $out) | Out-Null
[System.IO.File]::WriteAllText($out, ($manifest | ConvertTo-Json -Depth 10), [System.Text.UTF8Encoding]::new($false))
$manifest | ConvertTo-Json -Depth 10
