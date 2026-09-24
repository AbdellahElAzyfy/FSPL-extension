# One-time setup: registers a daily Windows scheduled task that runs update-xg-local.ps1.
# Runs as the current user only while logged on (so git's credential manager works),
# and catches up at next logon/wake if the scheduled time was missed.

$taskName = "FSPL team xG update"
$script = Join-Path $PSScriptRoot "update-xg-local.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At "10:00"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
  -Description "Fetches SPL team xG from Sofascore and pushes data/ to GitHub" -Force | Out-Null

Write-Output "Registered '$taskName' (daily 10:00). Run now with: Start-ScheduledTask -TaskName '$taskName'"
