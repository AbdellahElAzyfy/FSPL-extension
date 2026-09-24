# Runs the team xG update from this machine and pushes the result.
# Sofascore 403s GitHub Actions runners, so this runs via Windows Task Scheduler
# instead (see scripts/register-xg-task.ps1). Log: logs/update-xg.log

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$logDir = Join-Path $repoRoot "logs"
New-Item -ItemType Directory -Force $logDir | Out-Null
Start-Transcript -Path (Join-Path $logDir "update-xg.log") -Append | Out-Null

function Fail($message) {
  Write-Output "FAILED: $message"
  Stop-Transcript | Out-Null
  exit 1
}

Write-Output "=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="

git pull --ff-only --quiet
if ($LASTEXITCODE -ne 0) { Fail "git pull --ff-only (local branch diverged or dirty data/ files?)" }

npm run fetch:xg
if ($LASTEXITCODE -ne 0) { Fail "npm run fetch:xg" }

# team-xg.json always changes (generatedAt), so only commit when new matches were cached.
git diff --quiet -- data/team-xg-state.json
if ($LASTEXITCODE -eq 0) {
  git checkout -- data/team-xg.json
  Write-Output "No new matches; nothing to commit."
} else {
  git commit --quiet -m "Update team xG data" -- data/team-xg.json data/team-xg-state.json
  if ($LASTEXITCODE -ne 0) { Fail "git commit" }
  git push --quiet
  if ($LASTEXITCODE -ne 0) { Fail "git push" }
  Write-Output "Committed and pushed new xG data."
}

Stop-Transcript | Out-Null
