# FeetOnFocus Backup Organizer
# This script moves backup files from Downloads to the correct backup folders

$DownloadsPath = "$env:USERPROFILE\Downloads"
$ProjectPath = "C:\Users\shuai\OneDrive\Documents\GitHub\FeetOnFocus"
$AutoBackupPath = "$ProjectPath\backups\auto"
$ManualBackupPath = "$ProjectPath\backups\manual"

Write-Host "Organizing FeetOnFocus backup files..." -ForegroundColor Green
Write-Host "" 

# Get all FeetOnFocus backup files from Downloads
$AutoBackups = Get-ChildItem -Path $DownloadsPath -Filter "feetonfocus_auto_*.json" -ErrorAction SilentlyContinue
$ManualBackups = Get-ChildItem -Path $DownloadsPath -Filter "feetonfocus_manual_*.json" -ErrorAction SilentlyContinue
$DailyBackups = Get-ChildItem -Path $DownloadsPath -Filter "feetonfocus_daily_*.json" -ErrorAction SilentlyContinue

# Move auto backups
foreach ($backup in $AutoBackups) {
    try {
        Move-Item -Path $backup.FullName -Destination $AutoBackupPath -Force
        Write-Host "[AUTO] Moved $($backup.Name)" -ForegroundColor Cyan
    }
    catch {
        Write-Host "[ERROR] Failed to move $($backup.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Move manual backups
foreach ($backup in $ManualBackups) {
    try {
        Move-Item -Path $backup.FullName -Destination $ManualBackupPath -Force
        Write-Host "[MANUAL] Moved $($backup.Name)" -ForegroundColor Yellow
    }
    catch {
        Write-Host "[ERROR] Failed to move $($backup.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Move daily backups to auto folder
foreach ($backup in $DailyBackups) {
    try {
        Move-Item -Path $backup.FullName -Destination $AutoBackupPath -Force
        Write-Host "[DAILY] Moved $($backup.Name)" -ForegroundColor Blue
    }
    catch {
        Write-Host "[ERROR] Failed to move $($backup.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

$TotalMoved = $AutoBackups.Count + $ManualBackups.Count + $DailyBackups.Count
Write-Host ""
Write-Host "Organization complete! Moved $TotalMoved backup files." -ForegroundColor Green

if ($TotalMoved -eq 0) {
    Write-Host "No FeetOnFocus backup files found in Downloads folder." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Backup folders:" -ForegroundColor White
Write-Host "   Auto: $AutoBackupPath" -ForegroundColor Cyan
Write-Host "   Manual: $ManualBackupPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Run this script anytime to organize your backup files!" -ForegroundColor Green
