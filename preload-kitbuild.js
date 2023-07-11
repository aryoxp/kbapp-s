window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency])
  }
})

const { contextBridge, ipcRenderer, ipcMain } = require('electron')

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openFileResult: (data) => ipcRenderer.on('open-file-result', data),
  getLoadedFile: () => ipcRenderer.invoke('get-loaded-file'),
  getLoadedFileResult: (data) => ipcRenderer.on('get-loaded-file-result', data), 
  loadConceptMap: () => ipcRenderer.invoke('load-concept-map'),
  loadConceptMapResult: (data) => ipcRenderer.on('load-concept-map-result', data),
  openKit: (data) => ipcRenderer.invoke('open-kit', data),
  saveKit: (conceptMapData) => ipcRenderer.invoke('save-kit', conceptMapData),
  saveKitResult: (data) => ipcRenderer.on('save-kit-result', data),
  saveLearnerMap: (cmap, kit, lmap) => ipcRenderer.invoke('save-lmap', cmap, kit, lmap),
});
