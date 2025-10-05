/**
 * Desktop Backup Helper for Electron
 * Provides native file system backup functionality
 */

const { ipcRenderer } = require('electron');

class DesktopBackupHelper {
    /**
     * Save backup file directly to file system
     */
    static async saveBackupFile(fileName, data, type = 'auto') {
        try {
            const result = await ipcRenderer.invoke('save-backup-file', fileName, data);
            if (result.success) {
                console.log(`✅ Desktop backup saved: ${result.path}`);
                return result.path;
            } else {
                console.error('❌ Desktop backup failed:', result.error);
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error in desktop backup:', error);
            throw error;
        }
    }

    /**
     * Export backup file with save dialog
     */
    static async exportBackupFile(fileName, data) {
        try {
            const result = await ipcRenderer.invoke('export-backup-file', fileName, data);
            if (result.success) {
                console.log(`✅ Backup exported: ${result.path}`);
                return result.path;
            } else if (result.canceled) {
                console.log('Export canceled by user');
                return null;
            } else {
                console.error('❌ Export failed:', result.error);
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error exporting backup:', error);
            throw error;
        }
    }

    /**
     * List all backup files in the file system
     */
    static async listBackupFiles() {
        try {
            const result = await ipcRenderer.invoke('list-backup-files');
            if (result.success) {
                return result.files;
            } else {
                console.error('❌ Failed to list backup files:', result.error);
                return [];
            }
        } catch (error) {
            console.error('Error listing backup files:', error);
            return [];
        }
    }

    /**
     * Read backup file content
     */
    static async readBackupFile(filePath) {
        try {
            const result = await ipcRenderer.invoke('read-backup-file', filePath);
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error reading backup file:', error);
            throw error;
        }
    }

    /**
     * Delete backup file
     */
    static async deleteBackupFile(filePath) {
        try {
            const result = await ipcRenderer.invoke('delete-backup-file', filePath);
            if (result.success) {
                console.log(`✅ Backup deleted: ${filePath}`);
                return true;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error deleting backup file:', error);
            throw error;
        }
    }

    /**
     * Check if running in desktop mode
     */
    static isDesktopMode() {
        return typeof require !== 'undefined' && ipcRenderer;
    }
}