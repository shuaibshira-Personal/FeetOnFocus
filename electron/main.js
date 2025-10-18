const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');

let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../assets/logo/FEET_LOGO_round_updated.jpg'),
        show: false // Don't show until ready
    });

    // Load the app
    mainWindow.loadFile('index.html');

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Enable DevTools for debugging (you can disable this later)
        // mainWindow.webContents.openDevTools(); // Uncomment to auto-open DevTools
    });
    
    // Enable keyboard shortcuts for DevTools (Ctrl+Shift+I, F12)
    mainWindow.webContents.on('before-input-event', (event, input) => {
        // F12 key
        if (input.key === 'F12') {
            mainWindow.webContents.toggleDevTools();
        }
        // Ctrl+Shift+I
        if (input.control && input.shift && input.key === 'I') {
            mainWindow.webContents.toggleDevTools();
        }
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App event listeners
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handlers for file system operations
ipcMain.handle('save-backup-file', async (event, fileName, data) => {
    try {
        const appPath = app.getAppPath();
        const backupsDir = path.join(appPath, 'backups');
        
        // Determine subfolder based on file type
        let subDir;
        if (fileName.includes('manual_')) {
            subDir = path.join(backupsDir, 'manual');
        } else if (fileName.includes('daily_')) {
            subDir = path.join(backupsDir, 'auto');
        } else {
            subDir = path.join(backupsDir, 'auto');
        }

        // Ensure directory exists
        await ensureDirectoryExists(subDir);

        // Write file
        const filePath = path.join(subDir, fileName);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

        console.log(`Backup saved: ${filePath}`);
        return { success: true, path: filePath };
    } catch (error) {
        console.error('Error saving backup file:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('export-backup-file', async (event, fileName, data) => {
    try {
        // Show save dialog
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Backup',
            defaultPath: fileName,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (result.canceled) {
            return { success: false, canceled: true };
        }

        // Write file to chosen location
        await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf8');
        
        console.log(`Backup exported: ${result.filePath}`);
        return { success: true, path: result.filePath };
    } catch (error) {
        console.error('Error exporting backup file:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('list-backup-files', async () => {
    try {
        const appPath = app.getAppPath();
        const backupsDir = path.join(appPath, 'backups');
        const backupFiles = [];

        // Check auto backups
        const autoDir = path.join(backupsDir, 'auto');
        if (existsSync(autoDir)) {
            const autoFiles = await fs.readdir(autoDir);
            for (const file of autoFiles) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(autoDir, file);
                    const stat = await fs.stat(filePath);
                    backupFiles.push({
                        name: file,
                        type: 'auto',
                        path: filePath,
                        size: stat.size,
                        created: stat.birthtime,
                        modified: stat.mtime
                    });
                }
            }
        }

        // Check manual backups
        const manualDir = path.join(backupsDir, 'manual');
        if (existsSync(manualDir)) {
            const manualFiles = await fs.readdir(manualDir);
            for (const file of manualFiles) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(manualDir, file);
                    const stat = await fs.stat(filePath);
                    backupFiles.push({
                        name: file,
                        type: 'manual',
                        path: filePath,
                        size: stat.size,
                        created: stat.birthtime,
                        modified: stat.mtime
                    });
                }
            }
        }

        return { success: true, files: backupFiles };
    } catch (error) {
        console.error('Error listing backup files:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('read-backup-file', async (event, filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return { success: true, data: JSON.parse(data) };
    } catch (error) {
        console.error('Error reading backup file:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-backup-file', async (event, filePath) => {
    try {
        await fs.unlink(filePath);
        console.log(`Backup deleted: ${filePath}`);
        return { success: true };
    } catch (error) {
        console.error('Error deleting backup file:', error);
        return { success: false, error: error.message };
    }
});

// Helper function to ensure directory exists
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}