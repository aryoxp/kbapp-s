// main.js

// Modules to control application life and create native browser window
const { app, dialog, BrowserWindow, ipcMain, electron } = require('electron')
const path = require('path')
const fs = require('fs');
const ini = require('ini');
// const contextMenu = require('electron-context-menu');
const pako = require('pako');

// const { dialog } = require('electron')
var mainWindow;
var composeKitWindow;

var file;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 718,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true
    },
    autoHideMenuBar: true
  });

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')
  mainWindow.webContents.once('did-finish-load', () => {
    // mainWindow.webContents.openDevTools();
    mainWindow.show();
  });
  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

const createComposeKitWindow = (data) => {
  // Create the browser window.
  composeKitWindow = new BrowserWindow({
    width: 1024,
    height: 718,
    webPreferences: {
      preload: path.join(__dirname, 'preload-compose-kit.js'),
      spellcheck: true
    },
    autoHideMenuBar: true,
    show: false,
    parent: mainWindow, 
    modal: true 
  });
  let pos = mainWindow.getPosition();
  composeKitWindow.loadFile('compose-kit.html');
  composeKitWindow.setPosition(pos[0] + 25, pos[1] + 50);
  composeKitWindow.webContents.once('did-finish-load', () => {
    // composeKitWindow.webContents.openDevTools();
    composeKitWindow.show();
  });

}

const createKitBuildWindow = (data) => {
  // Create the browser window.
  composeKitWindow = new BrowserWindow({
    width: 1024,
    height: 718,
    webPreferences: {
      preload: path.join(__dirname, 'preload-kitbuild.js'),
      spellcheck: true
    },
    autoHideMenuBar: true,
    show: false
  })
  composeKitWindow.loadFile('kitbuild.html');
  composeKitWindow.webContents.once('did-finish-load', () => {
    // composeKitWindow.webContents.send('open-kit', data);
    // composeKitWindow.webContents.openDevTools();
    composeKitWindow.show();
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

  ipcMain.handle('open-file', (event, data) => {
    dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
      properties: ['openFile']
    }).then(result => {
      if (result.canceled) {
        event.sender.send('open-file-cancelled', true);
        // event.sender.send('open-file-result', false);
        return;
      }
      if (result.filePaths.length > 0) {
        let data = fs.readFileSync(result.filePaths[0], {
          encoding: "utf-8"
        });
        file = ini.parse(data);
        file.fileName = result.filePaths[0];
        event.sender.send('open-file-result', file);
      }
    });
  });

  async function handleOpenImage() {
    const { canceled, filePaths } = await dialog.showOpenDialog()
    if (!canceled) {
      // return filePaths[0];
      return fs.readFileSync(filePaths[0], 'base64');
    }
  }

  ipcMain.handle('open-image', handleOpenImage);

  var saveFile = function (event, data, options) {
    options = Object.assign({silent: false}, options);
    // console.log(data, options);
    let filePath = data.fileName;
    
    if(!filePath) {
      filePath = dialog.showSaveDialogSync(BrowserWindow.getFocusedWindow(), {
        defaultPath: 'temp.cmap'
      });
      if (filePath === undefined) {
        event.sender.send(('save-file-as-cancelled'), true);
        return;
      }
    }
    if (fs.access(filePath, fs.F_OK, (err) => {
      delete data.fileName;
      if (err) {
        let d = {};
        d.conceptMap = compress(data);
        let fileData = ini.stringify(d);
        fs.writeFileSync(filePath, fileData);
        event.sender.send((options.silent ? 'save-file-as-result-silent' : 'save-file-as-result'), true, filePath, ini.parse(fileData));
        return;
      } 
      let d = ini.parse(fs.readFileSync(filePath, {encoding: 'utf-8'}));
      d.conceptMap = compress(data);
      // console.log(filePath, ini.stringify(d));
      let fileData = ini.stringify(d);
      fs.writeFileSync(filePath, fileData);
      event.sender.send((options.silent ? 'save-file-as-result-silent' : 'save-file-as-result'), true, filePath, ini.parse(fileData));
    }));
  }

  ipcMain.handle('get-loaded-file', (event) => {
    event.sender.send('get-loaded-file-result', file);
  });

  ipcMain.handle('save-file-as', (event, data) => saveFile(event, data));
  ipcMain.handle('save-file-as-silent', (event, data) => saveFile(event, data, {silent: true}));

  ipcMain.handle('compose-kit', (event, fileName) => {
    // console.log(fileName);
    this.fileName = fileName;
    createComposeKitWindow();
  });

  ipcMain.handle('load-concept-map', (event) => {
    let data = fs.readFileSync(this.fileName, {
      encoding: "utf-8"
    });
    let file = ini.parse(data);
    // console.log(data, file);
    event.sender.send('load-concept-map-result', file.conceptMap);
  });

  ipcMain.handle('load-kit', (event) => {
    let data = fs.readFileSync(this.fileName, {
      encoding: "utf-8"
    });
    let file = ini.parse(data);
    // console.log(data, file);
    event.sender.send('load-kit-result', file.kit);
  });

  async function handleOpenKit() {
    const { canceled, filePaths } = await dialog.showOpenDialog()
    if (!canceled) {
      return fs.readFileSync(filePaths[0], { encoding: 'utf-8'});
    }
  }

  ipcMain.handle('open-kit', handleOpenKit);

  ipcMain.handle('save-kit', (event, data) => {
    let d = ini.parse(fs.readFileSync(this.fileName, { encoding: 'utf-8'}));
    d.kit = compress(data);
    // console.log(d, this.fileName);
    fs.writeFileSync(this.fileName, ini.stringify(d));
    event.sender.send('save-kit-result', true, d);
  });

  saveKitAs = (filePath, d) => {
    return new Promise((resolve, reject) => {
      if (fs.access(filePath, fs.F_OK, (err) => {
        if (err) { // file not exists, it is a new file
          fs.writeFileSync(filePath, ini.stringify(d));
          d.fileName = filePath;
          // console.log('new file', d, this.fileName, this);
          resolve(d);
          return d;
        }
        // file exists, overwriting
        let dd = ini.parse(fs.readFileSync(filePath, {encoding: 'utf-8'}));
        dd.conceptMap = d.conceptMap;
        dd.kit = d.kit;
        let fileData = ini.stringify(dd);
        fs.writeFileSync(filePath, fileData);
        // console.log('overwriting', dd, this.fileName, this);
        resolve(dd);
        return dd;
      }));
    });
  }

  ipcMain.handle('save-kit-as', async (event, data) => {
    let d = ini.parse(fs.readFileSync(this.fileName, { encoding: 'utf-8'}));
    d.kit = compress(data);    
    let { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
      defaultPath: 'kit-new.cmap'
    });
    if (canceled) {
      return {
        result: false,
        reason: 'cancelled'
      };
    }
    this.fileName = filePath;
    return await saveKitAs(filePath, d);
  });

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

// contextMenu({
// 	showSaveImageAs: true,
//   prepend: (defaultActions, parameters, browserWindow) => [
// 		{
// 			label: 'Rainbow',
// 			// Only show it when right-clicking images
// 			visible: parameters.mediaType === 'image'
// 		},
// 		{
// 			label: 'Search Google for “{selection}”',
// 			// Only show it when right-clicking text
// 			visible: parameters.selectionText.trim().length > 0,
// 			click: () => {
// 				shell.openExternal(`https://google.com/search?q=${encodeURIComponent(parameters.selectionText)}`);
// 			}
// 		}
// 	]
// });

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