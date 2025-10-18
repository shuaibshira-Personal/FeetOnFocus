const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Backup file operations
    saveBackupFile: (fileName, data) => ipcRenderer.invoke('save-backup-file', fileName, data),
    exportBackupFile: (fileName, data) => ipcRenderer.invoke('export-backup-file', fileName, data),
    listBackupFiles: () => ipcRenderer.invoke('list-backup-files'),
    readBackupFile: (filePath) => ipcRenderer.invoke('read-backup-file', filePath),
    deleteBackupFile: (filePath) => ipcRenderer.invoke('delete-backup-file', filePath)
});