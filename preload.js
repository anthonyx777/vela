'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a deliberately small API. The renderer never receives ipcRenderer itself.
contextBridge.exposeInMainWorld('vela', {
  getState: () => ipcRenderer.invoke('vela:get-state'),
  createTab: () => ipcRenderer.invoke('vela:create-tab'),
  createPrivateTab: () => ipcRenderer.invoke('vela:create-private-tab'),
  activateTab: (tabId) => ipcRenderer.invoke('vela:activate-tab', tabId),
  closeTab: (tabId) => ipcRenderer.invoke('vela:close-tab', tabId),
  navigate: (tabId, input) => ipcRenderer.invoke('vela:navigate', tabId, input),
  goBack: (tabId) => ipcRenderer.invoke('vela:go-back', tabId),
  goForward: (tabId) => ipcRenderer.invoke('vela:go-forward', tabId),
  reload: (tabId) => ipcRenderer.invoke('vela:reload', tabId),
  onState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('vela:state', listener);
    return () => ipcRenderer.removeListener('vela:state', listener);
  },
  onFocusAddress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('vela:focus-address', listener);
    return () => ipcRenderer.removeListener('vela:focus-address', listener);
  },
  onBookmarkShortcut: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('vela:bookmark-current', listener);
    return () => ipcRenderer.removeListener('vela:bookmark-current', listener);
  }
});
