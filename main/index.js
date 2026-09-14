const { app, BrowserWindow } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let appServe;

const initializeApp = async () => {
    const { default: serve } = await import('electron-serve');
    appServe = app.isPackaged ? serve({ directory: path.join(__dirname, '../out') }) : null;

    const createWindow = () => {
        const win = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
            },
        });

        if (app.isPackaged) {
            appServe(win).then(() => {
                win.loadURL('app://-');
            });
        } else {
            win.loadURL('http://localhost:3000');
            win.webContents.on('did-fail-load', () => {
                win.webContents.reloadIgnoringCache();
            });
        }
    };

    app.on('ready', () => {
        createWindow();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
};

initializeApp();
