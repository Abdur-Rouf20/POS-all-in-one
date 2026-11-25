$ErrorActionPreference = 'Stop'
Write-Host 'Checking Hyper-V feature...'
$feature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
if ($feature.State -ne 'Enabled') { Write-Warning 'Hyper-V is not enabled. Run as Administrator: Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All -NoRestart' } else { Write-Host 'Hyper-V is enabled.' }
Write-Host 'Checking available memory and disk...'
$os = Get-CimInstance Win32_OperatingSystem
$totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
Write-Host "Host RAM: $totalGB GB"
Get-Volume | Where-Object DriveLetter | Select-Object DriveLetter, FileSystemLabel, @{N='FreeGB';E={[math]::Round($_.SizeRemaining/1GB,1)}} | Format-Table -AutoSize
Write-Host 'A practical starting point for a small shop VM is 4 vCPU, 8 GB RAM and 100 GB virtual disk; size for actual workload and backups.'
