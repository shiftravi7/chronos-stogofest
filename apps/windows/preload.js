// Safe bridge between the CHRONOS web UI and the Windows tracker. No Node access in the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chronosNative', {
  platform: 'windows',
  getDays: (n, settings) => ipcRenderer.invoke('usage:getDays', n, settings),
  setCategory: (id, category) => ipcRenderer.invoke('usage:setCategory', id, category),
  onUpdate: cb => { ipcRenderer.on('usage:updated', () => cb()); }
});
