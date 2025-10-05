# FeetOnFocus Backup System

## 🔄 Hybrid Backup Strategy

Your FeetOnFocus data is protected with both automatic browser storage and file system backups:

### Browser Storage (localStorage)
- **Auto Backups**: Every 15 minutes (keeps last 10)
- **Manual Backups**: Instant creation (keeps last 10)  
- **Fast Access**: Immediate restore/inspect functionality
- **Always Available**: Survives browser restarts

### File System Backups
- **Location**: Downloaded to your `Downloads` folder first
- **Organization**: Use the organizer scripts to move files here
- **Persistence**: Survive browser data clearing and OS reinstalls
- **Portability**: Easy to copy, share, or archive

## 📁 Folder Structure

```
backups/
├── auto/                    # Automatic and daily export backups
├── manual/                  # Manual backup files  
├── organize-backups.bat     # Easy double-click organizer
├── organize-backups.ps1     # PowerShell organizer script
└── README.md               # This file
```

## 🛠️ Organization Tools

### Option 1: Double-click the batch file
```
backups/organize-backups.bat
```

### Option 2: Run PowerShell script directly
```powershell
powershell -ExecutionPolicy Bypass -File "backups/organize-backups.ps1"
```

## 📅 Backup Schedule

- **Every 15 minutes**: localStorage auto backup
- **Every 4 hours**: Check for daily file export (max once/day)
- **Manual**: Instant localStorage + file download
- **Export**: Convert any localStorage backup to file

## 🔧 File Naming Convention

- **Auto**: `feetonfocus_auto_2025-10-05_21-45-30.json`
- **Manual**: `feetonfocus_manual_2025-10-05_21-45-30.json`  
- **Daily**: `feetonfocus_daily_2025-10-05_daily-export.json`

## 💡 Tips

1. **Run organizer regularly** to keep Downloads folder clean
2. **Keep both types** - browser storage for quick access, files for safety
3. **Export before major changes** - use manual backup for important milestones
4. **Archive old backups** - copy important backup files to external storage

## 🆘 Recovery

- **Quick restore**: Use browser storage backups from Data Management modal
- **Full recovery**: Import any JSON backup file from this folder
- **Emergency**: Use inspect/emergency restore tools if needed