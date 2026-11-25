param(
  [Parameter(Mandatory=$true)][string]$UbuntuIsoPath,
  [string]$VMName = 'POS-Ubuntu-Server',
  [string]$SwitchName = 'Default Switch',
  [string]$VMPath = 'D:\Hyper-V\POS-Ubuntu-Server',
  [long]$MemoryStartupBytes = 8GB,
  [int]$ProcessorCount = 4,
  [long]$DiskSizeBytes = 100GB
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command New-VM -ErrorAction SilentlyContinue)) { throw 'Hyper-V PowerShell module is not available. Enable Hyper-V and reboot first.' }
if (-not (Test-Path -LiteralPath $UbuntuIsoPath)) { throw "Ubuntu ISO not found: $UbuntuIsoPath" }
if (Get-VM -Name $VMName -ErrorAction SilentlyContinue) { throw "VM already exists: $VMName. Choose another VMName or inspect the existing VM." }
if (-not (Get-VMSwitch -Name $SwitchName -ErrorAction SilentlyContinue)) { throw "Hyper-V switch not found: $SwitchName. List switches with Get-VMSwitch." }
New-Item -ItemType Directory -Force -Path $VMPath | Out-Null
New-VM -Name $VMName -Generation 2 -MemoryStartupBytes $MemoryStartupBytes -NewVHDPath (Join-Path $VMPath "$VMName.vhdx") -NewVHDSizeBytes $DiskSizeBytes -Path $VMPath -SwitchName $SwitchName | Out-Null
Set-VMProcessor -VMName $VMName -Count $ProcessorCount
Set-VM -Name $VMName -AutomaticCheckpointsEnabled $false
Add-VMDvdDrive -VMName $VMName -Path $UbuntuIsoPath | Out-Null
$dvd = Get-VMDvdDrive -VMName $VMName
Set-VMFirmware -VMName $VMName -FirstBootDevice $dvd
Start-VM -Name $VMName
Write-Host "VM '$VMName' started. Complete the Ubuntu Server 24.04 LTS installation in the Hyper-V console. Then follow README_DEPLOYMENT.md inside Ubuntu."
