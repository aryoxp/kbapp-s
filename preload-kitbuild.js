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
  openKit: (data) => ipcRenderer.invoke('open-kit', data),
  saveLearnerMap: (cmap, kit, lmap) => ipcRenderer.invoke('save-lmap', cmap, kit, lmap),
});
