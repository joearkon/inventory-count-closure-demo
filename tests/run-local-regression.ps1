param(
  [int]$Port = 8787
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runId = [Guid]::NewGuid().ToString('N')
$persistPath = Join-Path $projectRoot ".tmp-regression-$runId"
$stdoutPath = Join-Path $persistPath 'wrangler.stdout.log'
$stderrPath = Join-Path $persistPath 'wrangler.stderr.log'
$workerProcess = $null
$nodePath = (Get-Command node -ErrorAction Stop).Source
$globalNodeModules = (& npm.cmd root -g).Trim()
$wranglerEntry = Join-Path $globalNodeModules 'wrangler\bin\wrangler.js'

if (-not (Test-Path -LiteralPath $wranglerEntry)) {
  throw "Global Wrangler entry point was not found: $wranglerEntry"
}

New-Item -ItemType Directory -Path $persistPath | Out-Null

try {
  Push-Location $projectRoot

  & node (Join-Path $projectRoot 'tests\diagnosis-v1-characterization.mjs')
  if ($LASTEXITCODE -ne 0) { throw "V1 diagnosis characterization failed with exit code $LASTEXITCODE" }

  & node (Join-Path $projectRoot 'tests\diagnosis-contracts.mjs')
  if ($LASTEXITCODE -ne 0) { throw "Diagnosis contract tests failed with exit code $LASTEXITCODE" }

  & node (Join-Path $projectRoot 'tests\diagnosis-v2-d2.mjs')
  if ($LASTEXITCODE -ne 0) { throw "D2 V2 engine tests failed with exit code $LASTEXITCODE" }

  & node (Join-Path $projectRoot 'tests\diagnosis-v2-other-rules.mjs')
  if ($LASTEXITCODE -ne 0) { throw "D1/S1/T2 V2 engine tests failed with exit code $LASTEXITCODE" }

  & npx.cmd wrangler d1 migrations apply inventory-count-closure-demo-db --local --persist-to $persistPath
  if ($LASTEXITCODE -ne 0) { throw "D1 migrations failed with exit code $LASTEXITCODE" }

  # Start Wrangler through its Node entry point so the returned process owns the
  # complete workerd child tree. Launching through npx.cmd can orphan workerd on
  # Windows and leave the temporary D1/R2 files locked after a successful run.
  $workerProcess = Start-Process -FilePath $nodePath `
    -ArgumentList @($wranglerEntry, 'dev', '--port', $Port, '--local', '--persist-to', $persistPath, '--compatibility-date', '2026-06-18') `
    -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

  $baseUrl = "http://127.0.0.1:$Port"
  $ready = $false
  # Cold Wrangler startup on Windows can exceed 30 seconds after all migrations
  # are applied and the Worker bundle grows. Allow up to 60 seconds without
  # hiding real exits.
  for ($attempt = 0; $attempt -lt 240; $attempt += 1) {
    if ($workerProcess.HasExited) { throw "Wrangler exited before becoming ready. See $stderrPath" }
    try {
      $response = Invoke-WebRequest -Uri "$baseUrl/api/system/storage-health" -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }
  if (-not $ready) { throw "Local Worker did not become ready at $baseUrl" }

  $previousBaseUrl = $env:BASE_URL
  $previousMutationTests = $env:MUTATION_TESTS
  try {
    $env:BASE_URL = $baseUrl
    $env:MUTATION_TESTS = '1'
    & node (Join-Path $projectRoot 'tests\regression.mjs')
    if ($LASTEXITCODE -ne 0) { throw "Regression suite failed with exit code $LASTEXITCODE" }

    & node (Join-Path $projectRoot 'tests\procurement-orders.mjs')
    if ($LASTEXITCODE -ne 0) { throw "Procurement and receipt scenario failed with exit code $LASTEXITCODE" }
  } finally {
    $env:BASE_URL = $previousBaseUrl
    $env:MUTATION_TESTS = $previousMutationTests
  }
} finally {
  if ($workerProcess -and -not $workerProcess.HasExited) {
    # Windows PowerShell 5.1 exposes Process.Kill() but not the newer
    # Kill(entireProcessTree) overload used by PowerShell 7 / modern .NET.
    $workerProcess.Kill()
    $workerProcess.WaitForExit()
  }
  if ($workerProcess) { $workerProcess.Dispose() }
  Pop-Location -ErrorAction SilentlyContinue

  if (Test-Path -LiteralPath $persistPath) {
    $resolvedPersistPath = (Resolve-Path -LiteralPath $persistPath).Path
    $expectedPrefix = "$projectRoot\"
    $leaf = Split-Path -Leaf $resolvedPersistPath
    if (-not $resolvedPersistPath.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not $leaf.StartsWith('.tmp-regression-')) {
      throw "Refusing to remove unexpected regression path: $resolvedPersistPath"
    }
    $removed = $false
    for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
      try {
        Remove-Item -LiteralPath $resolvedPersistPath -Recurse -Force
        $removed = $true
        break
      } catch {
        if ($attempt -eq 19) { throw }
        Start-Sleep -Milliseconds 250
      }
    }
    if (-not $removed) { throw "Regression path was not removed: $resolvedPersistPath" }
  }
}
