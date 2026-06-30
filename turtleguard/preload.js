import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('turtleSerial', {
  listPorts: () => ipcRenderer.invoke('serial:listPorts'),
  autoConnect: () => ipcRenderer.invoke('serial:autoConnect'),
  connect: (path) => ipcRenderer.invoke('serial:connect', path),
  disconnect: () => ipcRenderer.invoke('serial:disconnect'),
  getStatus: () => ipcRenderer.invoke('serial:getStatus'),
  sendPostureState: (state) => ipcRenderer.invoke('serial:sendPostureState', state),
  testServo: (position) => ipcRenderer.invoke('serial:testServo', position),
});

contextBridge.exposeInMainWorld('turtleSession', {
  start: (payload) => ipcRenderer.invoke('session:start', payload),
  pause: (payload) => ipcRenderer.invoke('session:pause', payload),
  resume: (payload) => ipcRenderer.invoke('session:resume', payload),
  end: (payload) => ipcRenderer.invoke('session:end', payload),
  getDraft: () => ipcRenderer.invoke('session:getDraft'),
});

contextBridge.exposeInMainWorld('turtleSystem', {
  onSuspend: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = () => callback();
    ipcRenderer.on('system:suspend', listener);

    return () => {
      ipcRenderer.removeListener('system:suspend', listener);
    };
  },
});
