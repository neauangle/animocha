"use strict";
/*
Initial setup was:
    npm init -y
    npm install typescript -D
    tsc --init
    npm install electron
    then add "start": "electron ." to scripts in package.json
    to run: npm start

TODO:
--estimated completion: 1.5 - 2 months
    * use !this.disabled && ... for control bar open file
    * dark theme toolbar
    * fullscreen
    * add "about" tab
        * abs position, slides down on mouse
    * icon
    * two branches - one for working on grammar backend
        * just make it its own project
    * build script to add in kanji, vocab and grammar
        * figure out how backups work
        * figure out best way to manually link grammar cards to ancestors
            * incorporate this info into the build script for the database OR just, yeah, figure out how to backup
    * fix up the aesthetics of the subtitle selection screen
        * make the labels for the radios too so clicking them selects the radios
    * when video is not transcoded (e.g. video game doc), its height can exceed the bounds rather than showing vertical black bars
        * I think I'm okay with this.
        * possible solution: copy instead of transcoding those ones
            * this would make a standard streaming interface too
            * see if it actually solves the problem
    * npm build script that comments out electron-reloader, copies over crypto-helper.js and edits the require path accordingly
    * after file open, get user to
        * select / create an episode pool
            * not mandatory- it will then just be a normal video player capable of two subs
            * maybe show that stuff on top right
    * hover on subs to show card details in top right
        * stack: go to ancestors and come back
    * search drawer
        * query language, advanced searches
    * edit card moves card details from top right to bottom right, covering the subtitles
        * stack: create new cards / move card to edit, cancel or publish to pop them off
        * encourage people to search for similar existing cards
        * review card fields etc.
    *  publish preview
        * add additional comments
        * diff format
    * add initial grammars, dictionary, kanji
        * have kanji linking automatic or just done at runtime for title parts without matches
    * new page / tab for edit queue (websockets, realtime)
        * users discuss and vote on edits in the order they were made
            * maybe support multiple websocket channels though, in case things speed up
        * rejected goes back to user with notes on why / what to fix
        * figure out points and voting system, card stiffness, etc
    * ability to download a database image / cache and use offline
        * have a "refesh" button in ui
    * create a subreddit?
    * reach out for testers
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.passIPCToClientSide = void 0;
const { app, ipcMain, Menu, nativeTheme, shell, ipcRenderer } = require("electron");
const electron_1 = require("electron"); //gives us Electron types apparently
const fs = require('fs');
const path = require("path");
const videoServer = require('./video-server');
//automatically refresh electron windows when files change (are saved)
require('electron-reload')(__dirname);
Menu.setApplicationMenu(null);
const USER_DATA_FILE_PATH = app.getPath("userData") + "\\config.json";
const userData = {
    "jpnFontSize": "1.8em",
    "engFontSize": "1.2em",
    "subtitleBackgroundAlpha": 0.5,
    "scrollingSubtitleFontSize": "1.15em",
    "files": {
    //name -> {subtitles: {"eng": {"filePath": "", "offsetSeconds""}}, "jpn": {...}}
    }
};
if (fs.existsSync(USER_DATA_FILE_PATH)) {
    const userDataString = fs.readFileSync(USER_DATA_FILE_PATH, { 'encoding': 'utf-8' });
    if (userDataString) {
        const userDataJSON = JSON.parse(userDataString);
        for (let key of Object.keys(userData)) {
            if (userDataJSON.hasOwnProperty(key)) {
                userData[key] = userDataJSON[key];
            }
        }
    }
}
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;
async function createWindow() {
    // Create the browser window.
    win = new electron_1.BrowserWindow({
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
    win.webContents.openDevTools();
    win.maximize();
    win.show();
    //Adds a handler for an invokeable IPC. This handler will be called whenever a renderer calls 
    //ipcRenderer.invoke(channel, ...args).
    //If listener returns a Promise, the eventual result of the promise will be returned as a reply to the 
    //remote caller. Otherwise, the return value of the listener will be used as the value of the reply.
    //see more: https://www.electronjs.org/docs/api/ipc-main
    ipcMain.handle('get-user-data', (event, args) => { return userData; });
    ipcMain.handle('update-user-data', (event, args) => {
        if (!fs.existsSync(USER_DATA_FILE_PATH)) {
            fs.mkdirSync(path.dirname(USER_DATA_FILE_PATH), { recursive: true });
        }
        fs.writeFileSync(USER_DATA_FILE_PATH, JSON.stringify(args));
    });
    ipcMain.handle('enable-dev-tools', (event, args) => { win.webContents.openDevTools(); });
    ipcMain.handle('start-loading-stream', (event, options) => { return videoServer.startLoadingStream(options); });
    ipcMain.handle('get-video-info', (event, simplified) => { return videoServer.getVideoInfo(simplified); });
    ipcMain.handle('get-subtitle-track-from-file', (event, filepath, language) => { return videoServer.getSubtitleTrackFromFile(filepath, language); });
    ipcMain.handle('convert-file-to-html-friendly', (event, videoInfo, subtitleTracks) => { return videoServer.convertFileToHTMLFriendly(win, videoInfo, subtitleTracks); });
}
async function passIPCToClientSide(type, ...args) {
    return new Promise((resolve, reject) => {
        const id = (Math.random() * 1000).toString();
        win.webContents.send('ipc', type, id, args);
        ipcMain.once(type + id, (event, ret) => {
            resolve(ret);
        });
    });
}
exports.passIPCToClientSide = passIPCToClientSide;
app.on("ready", createWindow);
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
/*
https://www.electronjs.org/docs/tutorial/security#12-disable-or-limit-navigation
If your app has no need to navigate or only needs to navigate to known pages, it is a good idea to
limit navigation outright to that known scope, disallowing any other kinds of navigation.
*/
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        event.preventDefault();
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
                shell.openExternal(info.url);
            });
        }
        return { action: 'deny' };
    });
});
function isSafeForExternalOpen(info) {
    return false;
}
