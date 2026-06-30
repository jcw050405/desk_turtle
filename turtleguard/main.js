import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { SerialManager } from './electron/serialManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serialManager = new SerialManager();

function registerIpcHandlers() {
  ipcMain.handle('serial:listPorts', async () => serialManager.listPorts());
  ipcMain.handle('serial:autoConnect', async () => serialManager.autoConnect());
  ipcMain.handle('serial:connect', async (_event, portPath) => serialManager.connect(portPath));
  ipcMain.handle('serial:disconnect', async () => serialManager.disconnect());
  ipcMain.handle('serial:getStatus', async () => serialManager.getStatus());
  ipcMain.handle('serial:sendPostureState', async (_event, state) =>
    serialManager.sendPostureState(state)
  );
  ipcMain.handle('serial:testServo', async (_event, position) => serialManager.testServo(position));

  const notImplemented = async () => ({
    ok: false,
    error: 'not implemented',
  });

  ipcMain.handle('session:start', notImplemented);
  ipcMain.handle('session:pause', notImplemented);
  ipcMain.handle('session:resume', notImplemented);
  ipcMain.handle('session:end', notImplemented);
  ipcMain.handle('session:getDraft', notImplemented);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Check if running in dev mode
  const isDev = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

  if (isDev) {
    // In development, load the Vite dev server URL
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  powerMonitor.on('suspend', () => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('system:suspend');
      }
    }

    void serialManager.disconnect();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  void serialManager.disconnect();
});

app.on('window-all-closed', () => {
  void serialManager.disconnect();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
