// main.js

// Modules to control application life and create native browser window
const { app, dialog, BrowserWindow, ipcMain, electron } = require('electron')
const path = require('path')
const fs = require('fs');
const ini = require('ini');
const pako = require('pako');

var kitBuildWindow;

const createKitBuildWindow = () => {
  // Create the browser window.
  kitBuildWindow = new BrowserWindow({
    width: 1024,
    height: 718,
    webPreferences: {
      preload: path.join(__dirname, 'preload-kitbuild.js'),
      spellcheck: true
    },
    autoHideMenuBar: true,
    show: false
  })
  kitBuildWindow.loadFile('kitbuild.html');
  kitBuildWindow.webContents.once('did-finish-load', () => {
    // composeKitWindow.webContents.openDevTools();
    kitBuildWindow.show();
  });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // createWindow();
  createKitBuildWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  })

  ipcMain.handle('ping', () => "pong");

  async function handleOpenKit() {
    const { canceled, filePaths } = await dialog.showOpenDialog()
    if (!canceled) {
      return fs.readFileSync(filePaths[0], { encoding: 'utf-8'});
    }
  }

  ipcMain.handle('open-kit', handleOpenKit);

  saveLearnemapAs = (filePath, d) => {
    return new Promise((resolve, reject) => {
      if (fs.access(filePath, fs.F_OK, (err) => {
        if (err) { // file not exists, it is a new file
          fs.writeFileSync(filePath, ini.stringify(d));
          d.fileName = filePath;
          // console.log('new file', d, filePath, this);
          resolve(d);
          return d;
        }
        // file exists, overwriting
        let dd = ini.parse(fs.readFileSync(filePath, {encoding: 'utf-8'}));
        dd.conceptMap = d.conceptMap;
        dd.kit = d.kit;
        dd.lmap = d.lmap;
        let fileData = ini.stringify(dd);
        fs.writeFileSync(filePath, fileData);
        // console.log('overwriting', dd, filePath, this);
        resolve(dd);
        return dd;
      }));
    });
  }

  ipcMain.handle('save-lmap', async (event, cmap, kit, lmap) => {
    // console.log(cmap, kit, lmap);
    let { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
      defaultPath: 'student.lmap'
    });
    if (canceled) {
      return {
        result: false,
        reason: 'cancelled'
      };
    }
    this.fileName = filePath;
    let d = {
      conceptMap: compress(cmap),
      kit: compress(kit),
      lmap: compress(lmap)
    }
    return await saveLearnemapAs(filePath, d);
  });

})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function compress(data) { // encoded to base64 encoding
  return btoa(String.fromCharCode.apply(null, pako.gzip(JSON.stringify(data), {to: 'string'})))
}

function decompress(data) { // decoded from base64 encoding
  return JSON.parse(pako.ungzip(new Uint8Array(atob(data).split('').map(c => { 
    return c.charCodeAt(0); 
  })), {to: 'string'}))
}