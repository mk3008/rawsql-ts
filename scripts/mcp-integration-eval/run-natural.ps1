param(
  [ValidateSet('dev','holdout')][string]$ScenarioSet = 'dev',
  [Parameter(Mandatory=$true)][string]$Iteration,
  [ValidateRange(1,10)][int]$Repetitions = 3,
  [string]$Model = 'gpt-5.6-terra',
  [string]$ReasoningEffort = 'medium',
  [switch]$Resume
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$scenarioPath = if ($ScenarioSet -eq 'dev') {
  Join-Path $PSScriptRoot 'scenarios.dev.json'
} else {
  Join-Path $repoRoot 'tmp\mcp-integration-eval\holdout\scenarios.json'
}
$runRoot = Join-Path $repoRoot "tmp\mcp-integration-eval\runs\$Iteration"
$workspaceRoot = Join-Path ([System.IO.Path]::GetTempPath()) "rawsql-mcp-integration-$Iteration"
$serverPath = Join-Path $repoRoot 'packages\mcp-server\dist\cli.js'
$freezePath = Join-Path $repoRoot 'tmp\mcp-integration-eval\ground-truth-freeze.json'
if ((Test-Path -LiteralPath $runRoot) -and -not $Resume) { throw "Run output already exists: $runRoot" }
if (-not (Test-Path -LiteralPath $serverPath)) { throw "Build MCP server first: $serverPath" }
if (-not (Test-Path -LiteralPath $freezePath)) { throw "Freeze ground truth first: $freezePath" }
$freeze = Get-Content -Raw -LiteralPath $freezePath | ConvertFrom-Json -Depth 100
$expectedHash = if ($ScenarioSet -eq 'dev') { $freeze.dev.sha256 } else { $freeze.holdout.sha256 }
$actualHash = (Get-FileHash -Algorithm SHA256 $scenarioPath).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) {
  throw "Scenario hash does not match the frozen ground truth: expected=$expectedHash actual=$actualHash path=$scenarioPath"
}
New-Item -ItemType Directory -Force -Path $runRoot,$workspaceRoot | Out-Null
$savedScenarioPath = Join-Path $runRoot 'scenarios.json'
if ($Resume -and (Test-Path -LiteralPath $savedScenarioPath)) {
  $savedHash = (Get-FileHash -Algorithm SHA256 $savedScenarioPath).Hash.ToLowerInvariant()
  if ($savedHash -ne $expectedHash) { throw "Saved scenario packet does not match the frozen ground truth: $savedScenarioPath" }
} else {
  [System.IO.File]::WriteAllBytes($savedScenarioPath, [System.IO.File]::ReadAllBytes($scenarioPath))
}
$packet = Get-Content -Raw -LiteralPath $savedScenarioPath | ConvertFrom-Json -Depth 100

$guidance = @'
You are investigating a SQL-related engineering request.
Use any available tools when they materially improve correctness or safety, and avoid unnecessary calls when the supplied files already answer the question.
Give a concise evidence-based answer. Do not claim database runtime facts that static evidence cannot establish.
'@

function Write-Utf8([string]$Path, [string]$Content) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

$manifestPath = Join-Path $runRoot 'manifest.json'
$manifest = [ordered]@{ schemaVersion=1; scenarioSet=$ScenarioSet; iteration=$Iteration; repetitions=$Repetitions; model=$Model; reasoningEffort=$ReasoningEffort; scenarioHash=$actualHash; gitHead=(git -C $repoRoot rev-parse HEAD).Trim() }
if ($Resume -and (Test-Path -LiteralPath $manifestPath)) {
  $savedManifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json -Depth 100
  foreach ($field in @('scenarioSet','iteration','repetitions','model','reasoningEffort','scenarioHash')) {
    if ($savedManifest.$field -ne $manifest.$field) { throw "Resume manifest mismatch for ${field}: $manifestPath" }
  }
} else {
  Write-Utf8 $manifestPath ($manifest | ConvertTo-Json -Depth 10)
}

foreach ($scenario in $packet.scenarios) {
  for ($rep = 1; $rep -le $Repetitions; $rep++) {
    $scenarioRoot = Join-Path $workspaceRoot "$($scenario.id)-r$rep"
    $outRoot = Join-Path $runRoot "$($scenario.id)\r$rep"
    if ($Resume -and (Test-Path -LiteralPath (Join-Path $outRoot 'metadata.json'))) {
      Write-Output ("SKIP {0} r{1}" -f $scenario.id,$rep)
      continue
    }
    New-Item -ItemType Directory -Force -Path $scenarioRoot,$outRoot | Out-Null
    foreach ($file in $scenario.files) { Write-Utf8 (Join-Path $scenarioRoot $file.path) $file.content }
    $prompt = "$guidance`n`nUser request:`n$($scenario.prompt)"
    $args = @(
      'exec','--ephemeral','--json','--ignore-user-config','--ignore-rules',
      '--sandbox','read-only','--skip-git-repo-check','-m',$Model,
      '-c',"model_reasoning_effort=`"$ReasoningEffort`"",
      '-C',$scenarioRoot,
      '-c','mcp_servers.rawsql.command="node"',
      '-c',"mcp_servers.rawsql.args=[`"$($serverPath.Replace('\','/'))`",`"--workspace`",`"$($scenarioRoot.Replace('\','/'))`"]",
      '-c','mcp_servers.rawsql.required=true',
      '-c','mcp_servers.rawsql.default_tools_approval_mode="approve"',
      $prompt
    )
    $trace = Join-Path $outRoot 'trace.jsonl'
    $stderr = Join-Path $outRoot 'stderr.log'
    $timer = [Diagnostics.Stopwatch]::StartNew()
    & codex @args 1> $trace 2> $stderr
    $exitCode = $LASTEXITCODE
    $timer.Stop()
    $metadata = [ordered]@{ scenarioId=$scenario.id; repetition=$rep; durationMilliseconds=$timer.ElapsedMilliseconds; exitCode=$exitCode; model=$Model; reasoningEffort=$ReasoningEffort }
    Write-Utf8 (Join-Path $outRoot 'metadata.json') ($metadata | ConvertTo-Json -Depth 10)
    Write-Output ("DONE {0} r{1} {2}ms exit={3}" -f $scenario.id,$rep,$timer.ElapsedMilliseconds,$exitCode)
  }
}
