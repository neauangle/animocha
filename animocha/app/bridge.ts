/*
    Preload scripts continue to have access to require and other Node.js features, 
    allowing developers to expose a custom API to remotely loaded content.

    We create a bridge between front-end javascript files and the main node.js process
    by exposing a specific API. 
*/


let handlerForSelectSubtitleStreamsRequest: any;
let conversionCallback: any;
let subtitlesReadycallback: any;


const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld(
    'bridge', {
        enableDevTools: () => ipcRenderer.invoke("enable-dev-tools"),
        //invoke send a message to the main process via a channel and expects a result asynchronously.
        //this is called as window.bridge.toggleDarkMode() in a client-side javascript file
        getUserData: () => ipcRenderer.invoke('get-user-data'),
        updateUserData: (userData: any) => ipcRenderer.invoke('update-user-data', userData),

        getVideoInfo: (simplified: boolean) => ipcRenderer.invoke('get-video-info', simplified),

        startLoadingStream: (options: any, subtitlesReadyFunc: any) => {
            subtitlesReadycallback = subtitlesReadyFunc;
            return ipcRenderer.invoke('start-loading-stream', options);
        },

        getSubtitleTrackFromFile: (filePath: string, language:string) => ipcRenderer.invoke('get-subtitle-track-from-file', filePath, language),

        setHandlerForSelectSubtitleStreamsRequest: (func: any) => {handlerForSelectSubtitleStreamsRequest = func},

        convertFileToHTMLFriendly: (videoInfo:any, subtitleTracks: any, callback:any) => {
            conversionCallback = callback;
            return ipcRenderer.invoke('convert-file-to-html-friendly', videoInfo, subtitleTracks);
        }
    }   
)

ipcRenderer.on('ipc', async (event, type, id, args) => {
    if (type === 'select-subtitle-streams-from-video'){
        if (handlerForSelectSubtitleStreamsRequest){
            let r = await handlerForSelectSubtitleStreamsRequest(...args); 
            event.sender.send(type + id, r);
        }
    } else if (type === 'conversion-update'){
        if (conversionCallback){
            conversionCallback(...args);
        }
    } else if (type === 'subtitles-ready'){
        if (subtitlesReadycallback){
            subtitlesReadycallback(...args);
        }
    }
   
});