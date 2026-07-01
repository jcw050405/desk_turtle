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
  list: () => ipcRenderer.invoke('session:list'),
  saveDraft: (payload) => ipcRenderer.invoke('session:saveDraft', payload),
  finish: (payload) => ipcRenderer.invoke('session:finish', payload),
  recoverOpen: () => ipcRenderer.invoke('session:recoverOpen'),
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
