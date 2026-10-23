param([ValidateSet('Pause','Resume','Status')][string]$Action = 'Status')
$deskName = 'INFO-DESK Longbridge Market Publisher'
if ($Action -eq 'Pause') { Disable-ScheduledTask -TaskName $deskName | Out-Null; Stop-ScheduledTask -TaskName $deskName }
if ($Action -eq 'Resume') { Enable-ScheduledTask -TaskName $deskName | Out-Null; Start-ScheduledTask -TaskName $deskName }
Get-ScheduledTask -TaskName $deskName | Select-Object TaskName,State
Get-ScheduledTaskInfo -TaskName $deskName | Select-Object LastRunTime,LastTaskResult,NextRunTime
