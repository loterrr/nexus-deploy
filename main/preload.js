const { contextBridge } = require('electron');

// Expose a minimal, safe API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    isElectron: true,
});
