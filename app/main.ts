/*
Initial setup was:
    npm init -y
    npm install typescript -D
    tsc --init
    npm install electron
    then add "start": "electron ." to scripts in package.json
    to run: npm start

TODO: 
--estimated completion: 0.5 - 1 months
    * icon (dave?)
    * anki exportation
    * add search for subtitle entries?
    * release gihub page, with pictures and feature list.
    * when video is not transcoded (e.g. video game doc), its height can exceed the bounds rather than showing vertical black bars
        * I think I'm okay with this.
        * possible solution: copy instead of transcoding those ones
            * this would make a standard streaming interface too
            * see if it actually solves the problem
*/


const {app, ipcMain, Menu, nativeTheme, shell, ipcRenderer} = require("electron");
import Electron, { MenuItem, BrowserWindow } from "electron";//gives us Electron types apparently
const fs = require('fs');
const path = require("path");
const videoServer = require('./video-server');

//automatically refresh electron windows when files change (are saved)
require('electron-reload')(__dirname);

Menu.setApplicationMenu(null);

const USER_DATA_FILE_PATH = app.getPath("userData") + "\\config.json";
const userData : any = {
    "jpnFontSize": "1.8em",
    "engFontSize": "1.2em",
    "subtitleBackgroundAlpha": 0.5,
    "scrollingSubtitleFontSize": "1.15em",
    "leftCellProportion": "73%",
    "dictionaryPanelProportion": "40%",
    "files": {
        //name -> {subtitles: {eng: {filePath, offsetSeconds, index, choiceIndex}}, jpn: {...}}
    }
}
if (fs.existsSync(USER_DATA_FILE_PATH)) {
    const userDataString = fs.readFileSync(USER_DATA_FILE_PATH, {'encoding': 'utf-8'});
    if (userDataString){
        const userDataJSON = JSON.parse(userDataString);
        for (let key of Object.keys(userData)){
            if (userDataJSON.hasOwnProperty(key)){
                userData[key] = userDataJSON[key];
            }
        }
    }
    
}


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win : BrowserWindow;

async function createWindow() {
    win = new BrowserWindow({
    backgroundColor: "#fff",
    width: 1400,
    height: 800,
    show: false,
    webPreferences: {
        sandbox: true,

        //Context isolation is an Electron feature that allows developers to run code in preload scripts 
        //and in Electron APIs in a dedicated JavaScript context. In practice, that means that global objects 
        //like Array.prototype.push or JSON.parse cannot be modified by scripts running in the renderer process.
        contextIsolation: true,
        enableRemoteModule: false,
        nodeIntegration: false,
        
        preload: path.join(__dirname, 'bridge.js'),
      }
    });
  
    win.loadFile(path.join(__dirname, "frontend/app.html"));

    win.maximize();
    win.show();

    //Adds a handler for an invokeable IPC. This handler will be called whenever a renderer calls 
    //ipcRenderer.invoke(channel, ...args).
    //If listener returns a Promise, the eventual result of the promise will be returned as a reply to the 
    //remote caller. Otherwise, the return value of the listener will be used as the value of the reply.
    //see more: https://www.electronjs.org/docs/api/ipc-main
    ipcMain.handle('get-user-data', (event, args) => {return userData;});
    ipcMain.handle('update-user-data', (event, args) => {
        if (!fs.existsSync(USER_DATA_FILE_PATH)){
            fs.mkdirSync(path.dirname(USER_DATA_FILE_PATH), {recursive: true});
        }
         fs.writeFileSync(USER_DATA_FILE_PATH, JSON.stringify(args));
    });
    ipcMain.handle('enable-dev-tools', (event, args) => {win.webContents.openDevTools();});
    ipcMain.handle('open-url', (event, url) => {shell.openExternal(url);});
    ipcMain.handle('set-full-screen', (event, val) => {win.setFullScreen(val)});
    ipcMain.handle('start-loading-stream', (event, options) => {return videoServer.startLoadingStream(options)});
    ipcMain.handle('get-video-info', (event, simplified) => {return videoServer.getVideoInfo(simplified)});
    ipcMain.handle('get-subtitle-track-from-file', (event, filepath, language) => {return videoServer.getSubtitleTrackFromFile(filepath, language)});
    ipcMain.handle('convert-file-to-html-friendly', (event, videoInfo, subtitleTracks) => {return videoServer.convertFileToHTMLFriendly(win, videoInfo, subtitleTracks)});
}

async function passIPCToClientSide(type: string, ...args: Array<any>){
    return new Promise((resolve, reject) => {
        const id = (Math.random() * 1000).toString();
        win.webContents.send('ipc', type, id, args);
        ipcMain.once(type+id, (event, ret) => {
            resolve(ret);
          })
    });
}

  
app.on("ready", createWindow);

app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  })


/*
https://www.electronjs.org/docs/tutorial/security#12-disable-or-limit-navigation
If your app has no need to navigate or only needs to navigate to known pages, it is a good idea to 
limit navigation outright to that known scope, disallowing any other kinds of navigation.
*/
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        event.preventDefault()
    });
});




/*
https://www.electronjs.org/docs/tutorial/security#14-do-not-use-openexternal-with-untrusted-content
Shell's openExternal allows opening a given protocol URI with the desktop's native utilities. 
On macOS, for instance, this function is similar to the open terminal command utility and will open 
the specific application based on the URI and filetype association.
*/
app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(info => {
        if (isSafeForExternalOpen(info)) {
            setImmediate(() => {
                shell.openExternal(info.url)
            })
        }
        return { action: 'deny' };
    })
});
function isSafeForExternalOpen(info: Electron.HandlerDetails) {
    return false;
}




export {passIPCToClientSide};
