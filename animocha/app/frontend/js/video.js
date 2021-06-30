/*

Just pass a div to NeauangleVideo.create. Works best with height 100% on that div. Example:

const videoCell = document.getElementById('video-player-cell');
const videoContainer = document.createElement('div');
videoContainer.style.height = '100%';
videoCell.appendChild(videoContainer);
const video = NeauangleVideo.create(videoContainer);
videoContainer.remove();

At the moment you can only have one of them working at a time, because ids clash.

Requirements:   
    Structure:
        somefolder/
            css/video.cc
            js/video.js
            img/video/
    Bridge:
        {streamPath, videoInfo} = await window.bridge.startLoadingStream({
            seekSeconds: ...,
            path: ...,
            isFirstInit: true/false
        }, handleSubsChoiceFunction);

        where
            streamPath = *.m3u8 || null if you want to try playing it without transcoding middleman
            subtitles =[{startTimeSeconds, endTimeSeconds, dialogue, a, an}, ...]
            videoInfo = {duration: <seconds>}

        and
            doesn't return until streamPath file actually exists

*/




const NeauangleVideo = {
    ERRORS: {
        ERROR_LOADING_STREAM: "ERROR_LOADING_STREAM",
        ERROR_SEEKING_TO_SUBTITLE: "ERROR_SEEKING_TO_SUBTITLE",
    },
    EVENTS: {
        ERROR: 'ERROR',
        VIDEO_LOAD_REQUEST: "VIDEO_LOAD_REQUEST",
        ABOUT_TO_LOAD_VIDEO: "ABOUT_TO_LOAD_VIDEO",
        SUBTITLE_CHOICE_AVAILABLE: "SUBTITLE_CHOICE_AVAILABLE",
        SUBTITLE_CHOICE_MADE: "SUBTITLE_CHOICE_MADE",
        VIDEO_LOADED: "VIDEO_LOADED",
        SUBTITLE_TRACK_READY: "SUBTITLE_TRACK_READY",
        NEW_CURRENT_SUBTITLE_ENTRY: "NEW_CURRENT_SUBTITLE_ENTRY",
    },

    UTIL: {
        getRelativeMouseFromElement:  function(e, element){
            var rect = element.getBoundingClientRect();
            var relativeX = e.clientX - rect.left;
            var relativeY = e.clientY - rect.top;   
            const proportionX = relativeX / rect.width;
            const proportionY = relativeY / rect.height;
            return {relativeX, relativeY, proportionX, proportionY}
        },
        
        
        formatSecondsToColons: function (seconds){
            let prepend = '';
            if (seconds < 0){
                seconds = -seconds
                prepend = '-';
            }
            let timeString = new Date(1000 * seconds).toISOString().substr(11, 8);
            if (timeString.startsWith('00')){
                timeString = timeString.slice(3);
            }
            return prepend+timeString;
        },

        //doesn't handle days, because why would we?
        formatColonsToSeconds: function (colonString){
            let sign = 1;
            if (colonString.startsWith('-')){
                sign = -1;
                colonString = colonString.slice(1);
            }
            const parts = colonString.split(':');
            parts.reverse();
            parts[0] = parts[0].replace(',', '.');
            let seconds = 0;
            for (let i = 0; i < parts.length; ++i){
                seconds += Number(parts[i]) * (60**i);
            }
            return sign*seconds;
        },
        
        
        fadeObjectInFast: function (obj){
            obj.classList.remove('neauangle-animate-opacity-out-fast');
            obj.classList.remove('neauangle-animate-opacity-out-super-fast');
            obj.style.opacity = 1;
            obj.classList.add('neauangle-animate-opacity-in-fast');
        },
        
        fadeObjectOutFast: function fadeObjectOutFast(obj){
            obj.classList.remove('neauangle-animate-opacity-in-fast');
            obj.classList.remove('neauangle-animate-opacity-in-super-fast');
            obj.style.opacity = 0;
            obj.classList.add('neauangle-animate-opacity-out-fast');
        },
        
        fadeObjectInSuperFast: function (obj){
            obj.classList.remove('neauangle-animate-opacity-out-fast');
            obj.classList.remove('neauangle-animate-opacity-out-super-fast');
            obj.style.opacity = 1;
            obj.classList.add('neauangle-animate-opacity-in-super-fast');
        },
        fadeObjectOutSuperFast: function (obj){
            obj.classList.remove('neauangle-animate-opacity-in-fast');
            obj.classList.remove('neauangle-animate-opacity-in-super-fast');
            obj.style.opacity = 0;
            obj.classList.add('neauangle-animate-opacity-out-super-fast');
        },
        
        clamp: function (value, min, max){
            return value < min ? min : value > max ? max : value;
        },
        
        
        wait: async function (ms) {
            return new Promise(function (resolve, reject) {
                setTimeout(resolve, ms)
            })
        }
    }

}



NeauangleVideo.create = function(containerDiv, initFilePath) {

const video = {} //the object we'll finally return

const videoPlayerCell = containerDiv;
videoPlayerCell.classList.add('neauangle-video-player-cell');

//desctructor
var mutationObserver = new MutationObserver( (mutationList, observer) => {
    mutationList.forEach( (mutation) => {
        if (mutation.removedNodes){
            for (let node of mutation.removedNodes){
                if (node === videoPlayerCell){
                    if (hls){
                        hls.stopLoad();
                        hls.detachMedia();
                        hls.destroy();
                    }
                    if (videoPlayer){
                        videoPlayer.pause();
                        videoPlayer.remove();
                    }
                }
            }
        }
    });
});
mutationObserver.observe(videoPlayerCell.parentElement, {childList: true});






//ability to emit signals
let eventTarget = (() => {
    let eventTarget = new EventTarget();
    let target = document.createTextNode(null);
    eventTarget.addEventListener = target.addEventListener.bind(target);
    eventTarget.removeEventListener = target.removeEventListener.bind(target);
    eventTarget.dispatchEvent = target.dispatchEvent.bind(target);
    return eventTarget;
})();
video.addEventListener = eventTarget.addEventListener;
video.removeEventListener = eventTarget.removeEventListener;
function emitEvent(name, data){
    const event = new CustomEvent(name);
    event.data = data
    eventTarget.dispatchEvent(event);
}









videoPlayerCell.innerHTML = `
    <div id='neauangle-video-overlay'>
        <div id="neauangle-video-top-bar"></div>
        <div id='neauangle-subtitles-outer-container'>
            <div id="neauangle-top-subtitles-container" class="neauangle-subtitle-container">
                <div class='neauangle-japanese-subtitles neauangle-subtitles'></div>
                <div class='neauangle-english-subtitles neauangle-subtitles'></div>
            </div>
            <div id="neauangle-bottom-subtitles-container" class="neauangle-subtitle-container">
                <div class='neauangle-japanese-subtitles neauangle-subtitles'></div>
                <div class='neauangle-english-subtitles neauangle-subtitles'></div>
            </div>
        </div>

        <div id="neauangle-video-overlay-icons">
            <img id='neauangle-open-file-button' class='neauangle-svg-icon neauangle-video-overlay-icon' src='img/video/icons/material-design/folder-open.svg'
                    onclick="document.getElementById('neauangle-file-input').click();">
            </img>
            <input id="neauangle-file-input" type="file" name="name" style="display: none;" />
            <img id='neauangle-big-play-button' class='neauangle-svg-icon neauangle-video-overlay-icon neauangle-disabled' src='img/video/icons/material-design/play-circle.svg'
                style="display: none;"> 
            </img>
        </div>
        <div id="neauangle-video-control-bar">

            <img id='neauangle-play-pause-button' class='neauangle-svg-icon neauangle-video-control-bar-button neauangle-disabled' src='img/video/icons/material-design/play.svg'/>
            <div id='neauangle-video-progress-time'>--:--:--/--:--:--</div>
            <div id='neauangle-video-progress-bar' class='neauangle-progress-bar'>
                <div id="neauangle-seek-preview-time">--:--</div>
                <div id="neauangle-current-time-marker"></div>
                <div id='neauangle-video-progress-bar-background' class='neauangle-progress-bar-background neauangle-disabled'>
                    <div id='neauangle-video-progress-bar-foreground' class='neauangle-progress-bar-foreground'>
                    </div>
                </div>
            </div>

            <div id="neauangle-volume-container">
                <div id='neauangle-volume-bar' class='neauangle-progress-bar'>
                    <div id='neauangle-volume-bar-background' class='neauangle-progress-bar-background neauangle-disabled'>
                        <div id='neauangle-volume-bar-foreground' class='neauangle-progress-bar-foreground' style="width: 100%;"></div>
                    </div>
                </div>
                    <div id="neauangle-volume-range" type="range" in="0" max="100" value="90" step="10"  >
                    <img id='neauangle-volume-button' class='neauangle-svg-icon neauangle-video-control-bar-button neauangle-disabled' src='img/video/icons/material-design/volume-high.svg'/>
                </div>
            </div>

            <img id='neauangle-control-bar-open-file-button' class='neauangle-svg-icon neauangle-video-overlay-icon neauangle-disabled' 
                src='img/video/icons/material-design/folder-open.svg'>
            </img>
            <input id="neauangle-control-bar-file-input" type="file" name="name" style="display: none;" />
        </div>

    </div>

    <div id="neauangle-video-player-container">
    </div>


    <div id="neauangle-subs-selection" style="display:none;" ><!---->
        <div id="neauangle-subs-selection-title">
            Multiple valid subtitle tracks for a language were found. Please select one:
        </div>
        <div id="neauangle-subs-selection-jpn-title" class="neauangle-subs-selection-title">Select Japanese Subtitle Track</div>
        <div id="neauangle-subs-selection-eng-title" class="neauangle-subs-selection-title">Select English Subtitle Track</div>
       
        <div id="neauangle-subs-selection-jpn-radios" class="neauangle-subs-selection-radios">

        </div>
        <div id="neauangle-subs-selection-eng-radios" class="neauangle-subs-selection-radios subs-selection-eng">
        </div>

        <button id="neauangle-subs-selection-continue-button">Continue</button>
    </div>



`


//sub selection if one file has multiple subs for the same language

const subSelectionRadioTemplate = `
<div>
    <input type="radio" name="neauangle-subs-selection-{{language}}" 
        id="neauangle-subs-selection-{{language}}-input-radios-{{id}}" value="{{id}}"
        class="subs-selection-{{language}}"/>
    <label for="neauangle-subs-selection-jpn-input-radios-{{id}}">{{title}}</label>
</div>
`

function getSubSelectionRadioBlock(language, id, title){
    const htmlString = subSelectionRadioTemplate.replaceAll('{{language}}', language)
                        .replaceAll('{{id}}', id)
                        .replaceAll('{{title}}', title);
    var dummyParent = document.createElement('div');
    dummyParent.innerHTML = htmlString;
    const ret = dummyParent.firstElementChild;
    ret.remove()
    return ret;
}





async function handleSelectSubtitleStreamsRequest(fileName, args){
    emitEvent(NeauangleVideo.EVENTS.SUBTITLE_CHOICE_AVAILABLE, {args});
    if ((!args.eng || args.eng.length <= 1) && (!args.jpn || args.jpn.length <= 1)){
        return args;
    }

    const subsSelectionContainer = document.getElementById("neauangle-subs-selection");
    subsSelectionContainer.style.display = "grid";
    for (let language of Object.keys(args)){
        const titleElement =  document.getElementById(`neauangle-subs-selection-${language}-title`);
        titleElement.style.opacity = 0.5;
        const radios = document.getElementById(`neauangle-subs-selection-${language}-radios`);
        for (let i = 0; i < args[language].length; ++i){
            const subtitleTrack = args[language][i];
            const radioBlock = getSubSelectionRadioBlock(language, i, subtitleTrack.title);
            radios.appendChild(radioBlock);
            const radio =  document.getElementById(`neauangle-subs-selection-${language}-input-radios-${i}`);
            if (i === 0){
                radio.checked = true;
                titleElement.style.opacity = 0.5;
            } else if (i > 1){
                titleElement.style.opacity = 1;
            }
            if (args[language].length <= 1){
                radio.disabled = true;
            }
        }
    }
    
    return new Promise((resolve, reject) => {
        document.getElementById("neauangle-subs-selection-continue-button").addEventListener('click', e => {
            let choiceIndexes = {eng: null, jpn: null};
            for (let language of Object.keys(args)){
                const selectedRadio = document.querySelector(`input[name="neauangle-subs-selection-${language}"]:checked`);
                if (selectedRadio){
                    args[language] = [args[language][Number(selectedRadio.value)]];
                    choiceIndexes[language] = Number(selectedRadio.value);
                }
            }
            subsSelectionContainer.style.display = "none";
            emitEvent(NeauangleVideo.EVENTS.SUBTITLE_CHOICE_MADE, {choiceIndexes});
            return resolve(args);

        })
    });

    

}






























const openFileButton = document.getElementById('neauangle-open-file-button');
const folderOpenSVGPath = `img/video/icons/material-design/folder-open.svg`;
const folderDropSVGPath = `img/video/icons/material-design/note-add.svg`;

const fileInput = document.getElementById('neauangle-file-input');
const bigPlayButton = document.getElementById('neauangle-big-play-button');
const loadingSVGPath = `img/video/icons/material-design/loading.svg`;
const playCircleSVGPath = `img/video/icons/material-design/play-circle.svg`;

const videoPlayerContainer = document.getElementById('neauangle-video-player-container');
const videoOverlayIcons = document.getElementById('neauangle-video-overlay-icons');
const videoTopBar = document.getElementById('neauangle-video-top-bar');
const videoControlBar = document.getElementById('neauangle-video-control-bar');
const playPauseButton = document.getElementById('neauangle-play-pause-button');
const playSVGPath = `img/video/icons/material-design/play.svg`;
const pauseSVGPath = `img/video/icons/material-design/pause.svg`;
const progressTime = document.getElementById('neauangle-video-progress-time');
const progressBarBackground = document.getElementById('neauangle-video-progress-bar-background');
const progressBarForeground = document.getElementById('neauangle-video-progress-bar-foreground');
const seekPreviewTime = document.getElementById('neauangle-seek-preview-time');
const currentTimeMarker = document.getElementById('neauangle-current-time-marker');


const volumeButton = document.getElementById('neauangle-volume-button');
const volumeBarBackground = document.getElementById('neauangle-volume-bar-background');
const volumeBarForeground= document.getElementById('neauangle-volume-bar-foreground');
const volumeHighSVGPath = `img/video/icons/material-design/volume-high.svg`;
const volumeMediumSVGPath = `img/video/icons/material-design/volume-medium.svg`;
const volumeLowSVGPath = `img/video/icons/material-design/volume-low.svg`;
const volumeMuteSVGPath = `img/video/icons/material-design/volume-mute.svg`;

const controlBarOpenFileButton = document.getElementById('neauangle-control-bar-open-file-button');
const controlBarFileInput = document.getElementById('neauangle-control-bar-file-input');



const subtitlesOuterContainer = document.getElementById('neauangle-subtitles-outer-container');
const topSubtitlesContainer = document.getElementById('neauangle-top-subtitles-container');
const bottomSubtitlesContainer = document.getElementById('neauangle-bottom-subtitles-container');
//const subtitlePositionContainers = [topSubtitlesContainer, bottomSubtitlesContainer];
const subtitleTreeInfo = {
    'top': {
        'jpn': {'currentEntries': [], 'container': topSubtitlesContainer.children[0]}, 
        'eng': {'currentEntries': [], 'container': topSubtitlesContainer.children[1]}
    },
    'bottom': {
        'jpn': {'currentEntries': [], 'container': bottomSubtitlesContainer.children[0]}, 
        'eng': {'currentEntries': [], 'container': bottomSubtitlesContainer.children[1]}
    }
};



const STATE = {
    UNLOADED:'UNLOADED', 
    PRELOADING:'PRELOADING',  
    PRELOADED:'PRELOADED', 
    PLAYING:'PLAYING', 
    PAUSED: "PAUSED", 
    SEEKING:'SEEKING'
};
let state;
changeState(STATE.UNLOADED);




const subtitleTracks = {
    eng: {
        language: 'eng',
        exists:false,
        entries: null,
        active: false,
        lastActiveIndexCache: 0,
        offsetSeconds: 0,
        filePath: null, 
    },
    jpn: {
        language: 'jpn',
        exists:false,
        entries: null,
        active: false,
        lastActiveIndexCache: 0,
        offsetSeconds: 0,
        filePath: null, 
    }
};

let subtitleContainerThatMouseIsOver = null;
let keepToCurrentSubtitleBecauseMouseOverSubtitles = null;
let currentVideoInfo;
let currentProgressTimeString;
let mouseIsOverProgressBar;//is used
let lowBufferThresholdSeconds = 0;
let highBufferThresholdSeconds = 0;
let currentSeekSeconds = 0;
let mouseOverVideoPlayerCell = false;
let currentProgressPercent = 0;
let currentSelectedFilePath;
let currentGlobalMouseCoords;
let mouseDownOverVolumeBar = false;
let currentVideoIsUsingHTMLNativeVideo = undefined;

let videoPlayer;
let hls;




function changeState(newState){
    state = newState;
}



document.addEventListener('mousemove', (ev) => {
    currentGlobalMouseCoords = ev;
    if (mouseDownOverVolumeBar){
        ev.preventDefault();//so we're not selecting everything
        const proportion = NeauangleVideo.UTIL.getRelativeMouseFromElement(ev, 
            volumeBarBackground
        ).relativeX / volumeBarBackground.getBoundingClientRect().width;
        setVolume(NeauangleVideo.UTIL.clamp(proportion, 0, 1));
    }
});

controlBarOpenFileButton.addEventListener('click', e => {
    if (!controlBarOpenFileButton.classList.contains('neauangle-disabled')){
        controlBarFileInput.click();
    }
})





fileInput.addEventListener('change', (event) => {
    initStream(fileInput.files[0].path);
});


controlBarFileInput.addEventListener('change', (event) => {
     emitEvent(NeauangleVideo.EVENTS.VIDEO_LOAD_REQUEST, {filePath: controlBarFileInput.files[0].path});
});

videoPlayerCell.addEventListener('dragenter', (ev) => {
    if (state === STATE.UNLOADED){
        openFileButton.classList.add('neauangle-invisible-to-mouse');
        openFileButton.src = folderDropSVGPath;
    }
});
videoPlayerCell.addEventListener('dragleave', (ev) => {
    if (state === STATE.UNLOADED){ 
        openFileButton.classList.remove('neauangle-invisible-to-mouse');
        openFileButton.src = folderOpenSVGPath;
    }
});

videoPlayerCell.addEventListener('dragover', (ev) => {
    //if (state === STATE.UNLOADED){
        ev.preventDefault();//enable the drop to us
    //}
});
videoPlayerCell.addEventListener('drop', ev => {
    ev.preventDefault();//prevent file from being opened
    if (ev.dataTransfer.items) {
        //todo: we could sort out subtitle files from video files for multiple files dropped
        if (ev.dataTransfer.items[0].kind === 'file') {
            var file = ev.dataTransfer.items[0].getAsFile();
            if (state === STATE.UNLOADED){
                initStream(file.path);
            } else {
                emitEvent(NeauangleVideo.EVENTS.VIDEO_LOAD_REQUEST, {filePath: fileInput.files[0].path});
            }
        }
    } 
});





async function addSubtitleTrack(subtitleTrack){
    const language = subtitleTrack.language;
    for (key of Object.keys(subtitleTrack)){
        subtitleTracks[language][key] = subtitleTrack[key];
    }
    subtitleTracks[language].exists = true;
    subtitleTracks[language].active = true;
    for (let position of Object.keys(subtitleTreeInfo)){
        subtitleTreeInfo[position][language].container.style.display = subtitleTracks[language].active ? 'flex' : 'none';
    }
    emitEvent(NeauangleVideo.EVENTS.SUBTITLE_TRACK_READY, {subtitleTrack: subtitleTracks[language]});
}

function setSubtitleOffsetSeconds(language, secondsOffset){
    subtitleTracks[language].offsetSeconds = secondsOffset
}
function toggleSubtitleIsActive(language){
    subtitleTracks[language].active = ! subtitleTracks[language].active;
    for (let position of Object.keys(subtitleTreeInfo)){
        subtitleTreeInfo[position][language].container.style.display = subtitleTracks[language].active ? 'flex' : 'none';
    }
    return subtitleTracks[language].active;
}

function setSubtitleBackgroundColour(language, colour, alpha){
    const alphaHex = Math.round(alpha*255).toString(16);
    videoPlayerCell.style.setProperty('--subtitle-background-colour-' + language, colour + alphaHex);
}
function getSubtitleBackgroundColour(language){
    return getComputedStyle(videoPlayerCell).getPropertyValue('--subtitle-background-colour-' + language);
}

function setSubtitleFontSize(language, unitString){
    videoPlayerCell.style.setProperty('--subtitle-font-size-' + language, unitString);
}

async function initStream(path, seekTo /*provide for seeks, rather than initial file loads*/){
    replaceVideoPlayer();
    
    currentSelectedFilePath = path;
    
    if (seekTo === undefined){
        changeState(STATE.PRELOADING);
        highBufferThresholdSeconds = 0
        lowBufferThresholdSeconds = 0
        openFileButton.style.display = 'none';
        bigPlayButton.style.display = 'inherit';
        videoControlBar.style.opacity = 0.2
        progressBarBackground.classList.add('neauangle-disabled');
        bigPlayButton.classList.add('neauangle-animate-rotating');
        bigPlayButton.src = loadingSVGPath;
    } else {
        changeState(STATE.SEEKING);
        lowBufferThresholdSeconds = seekTo; 
        playPauseButton.classList.add('neauangle-animate-rotating');
        playPauseButton.src = loadingSVGPath;
    }

    if (seekTo === undefined){
        emitEvent(NeauangleVideo.EVENTS.ABOUT_TO_LOAD_VIDEO, {filePath: currentSelectedFilePath});
    }
    
    try {
        let {streamPath, videoInfo} = await window.bridge.startLoadingStream({
            seekSeconds: lowBufferThresholdSeconds,
            path: currentSelectedFilePath,
            isFirstInit: seekTo === undefined
        }, (subtitles) => {
            for (let subtitleTrack of Object.values(subtitles)){
                if (subtitleTrack.length === 0){
                    continue;
                }
                addSubtitleTrack(subtitleTrack);
            }
        });
       

        if (seekTo === undefined){
            currentVideoInfo = videoInfo;
            emitEvent(NeauangleVideo.EVENTS.VIDEO_LOADED, {videoInfo});
            for (const subtitleTrack of Object.values(subtitleTracks)){
                if (subtitleTrack.exists){
                    emitEvent(NeauangleVideo.EVENTS.SUBTITLE_TRACK_READY, {subtitleTrack});
                }
            }
            volumeBarBackground.classList.remove('neauangle-disabled');
            volumeButton.classList.remove('neauangle-disabled');
            currentVideoIsUsingHTMLNativeVideo = streamPath === null;
            if (currentVideoIsUsingHTMLNativeVideo){ //means video-server.js thinks we can play it without ffmpeg...
                changeState(STATE.PRELOADED);
                videoPlayer.src = currentSelectedFilePath;
                bigPlayButton.src = playCircleSVGPath;
                bigPlayButton.classList.remove('neauangle-disabled');
                bigPlayButton.classList.remove('neauangle-animate-rotating'); 
                playPauseButton.classList.remove('neauangle-disabled');
                updateVideoProgress(lowBufferThresholdSeconds);
                progressBarBackground.classList.remove('neauangle-disabled');
                NeauangleVideo.UTIL.fadeObjectInFast(videoControlBar);
                NeauangleVideo.UTIL.fadeObjectInFast(videoTopBar);
                subtitlesOuterContainer.classList.remove('neauangle-full-height');
                controlBarOpenFileButton.classList.remove('neauangle-disabled');
                return;
            } 
        }

        hls.loadSource(streamPath);
        if (seekTo === undefined){
            changeState(STATE.PRELOADED);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoPlayer.currentTime = 0;
                bigPlayButton.src = playCircleSVGPath;
                bigPlayButton.classList.remove('neauangle-disabled');
                bigPlayButton.classList.remove('neauangle-animate-rotating'); 
                playPauseButton.classList.remove('neauangle-disabled');
                updateVideoProgress(lowBufferThresholdSeconds);
                progressBarBackground.classList.remove('neauangle-disabled');
                NeauangleVideo.UTIL.fadeObjectInFast(videoControlBar);
                NeauangleVideo.UTIL.fadeObjectInFast(videoTopBar);
                subtitlesOuterContainer.classList.remove('neauangle-full-height');
                controlBarOpenFileButton.classList.remove('neauangle-disabled');
            });
        } else {
            playPauseButton.classList.remove('neauangle-animate-rotating');
        }
    } catch (error) {
        emitEvent(NeauangleVideo.EVENTS.ERROR, {type: NeauangleVideo.ERRORS.ERROR_LOADING_STREAM, error: error});
    }
}




function replaceVideoPlayer() {
    if (hls){
        hls.stopLoad();
        hls.detachMedia();
        hls.destroy();
    }
    if (videoPlayer){
        videoPlayer.pause();
        videoPlayer.remove();
    }
   
    videoPlayer = document.createElement('video');
    videoPlayer.classList.add('neauangle-video-player');
    videoPlayerContainer.appendChild(videoPlayer);

    hls = new Hls();
    hls.attachMedia(videoPlayer);

    videoPlayer.addEventListener('play', (e) => {
        changeState(STATE.PLAYING);
        playPauseButton.src = pauseSVGPath;
    });
    videoPlayer.addEventListener('pause', (e) => {
        if (state !== STATE.SEEKING){
            changeState(STATE.PAUSED);
            playPauseButton.src = playSVGPath;
        }
    });
    videoPlayer.addEventListener('timeupdate', () => {
         //fixes a weird bug where switchign subtitle trscks a few times would
         //make the video loaded started a few seconds in. Dunno why that happens buuut *sweep, sweep*
        if (state === STATE.PRELOADED){
            videoPlayer.currentTime = 0;
            return;
        }
        currentSeekSeconds = lowBufferThresholdSeconds + videoPlayer.currentTime;
        if (lowBufferThresholdSeconds + videoPlayer.duration  > highBufferThresholdSeconds){
            highBufferThresholdSeconds = lowBufferThresholdSeconds + videoPlayer.duration
            const p = (highBufferThresholdSeconds-lowBufferThresholdSeconds) / currentVideoInfo.durationSeconds
            progressBarForeground.width = `${p}%`;
        } 
        updateVideoProgress(currentSeekSeconds);
    });

}




async function seek(seekSeconds, forceBufferInvalid=false){
    if (state == STATE.PRELOADED){
        NeauangleVideo.UTIL.fadeObjectOutFast(bigPlayButton);
        bigPlayButton.classList.add('neauangle-disabled');
    }
    const oldState = state;
    changeState(STATE.SEEKING); 

    //no need to throw out the range if we're still gonna be in it!
    if (currentVideoIsUsingHTMLNativeVideo || (!forceBufferInvalid && (seekSeconds >= lowBufferThresholdSeconds && seekSeconds <= highBufferThresholdSeconds))){
        updateVideoProgress(seekSeconds);
        videoPlayer.currentTime = seekSeconds-lowBufferThresholdSeconds;
        changeState(oldState);
    } else { 
        lowBufferThresholdSeconds = seekSeconds;
        highBufferThresholdSeconds = seekSeconds;

        progressBarForeground.style.width = '0';
        let p = (lowBufferThresholdSeconds / currentVideoInfo.durationSeconds) * 100;
        progressBarForeground.style.marginLeft = `${p}%`;
        updateVideoProgress(seekSeconds);

        await initStream(currentSelectedFilePath, seekSeconds);
        
        let promise = new Promise((resolve, b) => {
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                changeState(oldState);
                playPauseButton.src = state === STATE.PAUSED ?  playSVGPath : pauseSVGPath;
                if (subtitleContainerThatMouseIsOver){
                    keepToCurrentSubtitleBecauseMouseOverSubtitles = subtitleContainerThatMouseIsOver;
                }
                if (oldState == STATE.PLAYING){
                    videoPlayer.play();
                } 

                if (!mouseOverVideoPlayerCell){
                    NeauangleVideo.UTIL.fadeObjectOutFast(videoControlBar);
                    NeauangleVideo.UTIL.fadeObjectOutFast(videoTopBar);
                    subtitlesOuterContainer.classList.add('neauangle-full-height');
                } else {
                    NeauangleVideo.UTIL.fadeObjectInFast(videoControlBar);
                    NeauangleVideo.UTIL.fadeObjectInFast(videoTopBar);
                    subtitlesOuterContainer.classList.remove('neauangle-full-height');
                }

                resolve();
            });
        });

        return promise;

    }
}











bigPlayButton.addEventListener('click', (ev) => {
    if (!bigPlayButton.classList.contains('neauangle-disabled')){
        videoPlayer.play();
        NeauangleVideo.UTIL.fadeObjectOutFast(bigPlayButton);
        bigPlayButton.classList.add('neauangle-disabled');
    }
});



//does nothing if not in state pause or play
function togglePausePlay(){
    if (state === STATE.PLAYING){
        videoPlayer.pause();
    
    } else if (state === STATE.PAUSED){
        videoPlayer.play();
    }
}



videoOverlayIcons.addEventListener('click', (ev) => {
    if (!subtitleContainerThatMouseIsOver){
        togglePausePlay();
    }
});


playPauseButton.addEventListener('click', togglePausePlay);


videoPlayerCell.addEventListener('mouseenter', (e) => {
    mouseOverVideoPlayerCell = true;
    if (state === STATE.PLAYING || state === STATE.PAUSED){
        NeauangleVideo.UTIL.fadeObjectInFast(videoControlBar);
        NeauangleVideo.UTIL.fadeObjectInFast(videoTopBar);
        subtitlesOuterContainer.classList.remove('neauangle-full-height');
    }
})

videoPlayerCell.addEventListener('mouseleave', (e) => {
    mouseOverVideoPlayerCell = false;
    if (state === STATE.PLAYING || state === STATE.PAUSED){
        NeauangleVideo.UTIL.fadeObjectOutFast(videoControlBar);
        NeauangleVideo.UTIL.fadeObjectOutFast(videoTopBar);
        subtitlesOuterContainer.classList.add('neauangle-full-height');
    }
})



for (let subtitleContainer of [bottomSubtitlesContainer, topSubtitlesContainer]){
    subtitleContainer.addEventListener('mouseenter', (e) => {
        subtitleContainerThatMouseIsOver = subtitleContainer;
        if (state === STATE.PLAYING){
            keepToCurrentSubtitleBecauseMouseOverSubtitles = subtitleContainer;
        }
        
    });
    subtitleContainer.addEventListener('mouseleave', (e) => {
        subtitleContainerThatMouseIsOver = null;
        if (keepToCurrentSubtitleBecauseMouseOverSubtitles){
            keepToCurrentSubtitleBecauseMouseOverSubtitles = null;
            if (state === STATE.PAUSED){
                videoPlayer.play();
            }
        }
    })
}









volumeBarBackground.addEventListener('mousedown', volumeBarMouseDownUp)
function volumeBarMouseDownUp (e) {
    if (!volumeBarBackground.classList.contains('neauangle-disabled')){
        console.log('here');
        const proportion = NeauangleVideo.UTIL.getRelativeMouseFromElement(e, 
            volumeBarBackground
        ).relativeX / volumeBarBackground.getBoundingClientRect().width;
        setVolume(NeauangleVideo.UTIL.clamp(proportion, 0, 1));
        mouseDownOverVolumeBar= true;
        document.addEventListener('mouseup', () => {
            mouseDownOverVolumeBar = false;
            window.removeEventListener('mousemove', volumeBarMouseDownUp);
        });
    }
}

volumeButton.addEventListener('click', (ev) => {
    if (!volumeBarBackground.classList.contains('neauangle-disabled')){
        if (videoPlayer.volume > 0.75){
            setVolume(0);
        } else {
            setVolume(1.0);
        }
    }
});


function setVolume(volume){
    videoPlayer.volume = volume;
    volumeBarForeground.style.width = `${volume*100+4}%`;//dunno, 4 seems to work
    if (volume > 0.75){
        volumeButton.src = volumeHighSVGPath;
    } else if (volume > 0.25) {
        volumeButton.src = volumeMediumSVGPath;
    } else if (volume > 0) {
        volumeButton.src = volumeLowSVGPath;
    } else {
        volumeButton.src = volumeMuteSVGPath;
    }
}
















progressBarBackground.addEventListener('mousemove', (e) => {
    let {relativeX, seekSeconds} = getMouseSeekProportionAndRelativeX();
    seekPreviewTime.style.left = (relativeX - 15)  + 'px'; //15 seems to work
    seekPreviewTime.innerText = NeauangleVideo.UTIL.formatSecondsToColons(seekSeconds);        
})
progressBarBackground.addEventListener('mouseenter', (e) => {
    mouseIsOverProgressBar = true;
    if (!progressBarBackground.classList.contains('neauangle-disabled')){
        let {relativeX, seekSeconds} = getMouseSeekProportionAndRelativeX();
        seekPreviewTime.style.left = (relativeX - 15)  + 'px'; //15 seems to work
        seekPreviewTime.style.opacity = 1;
        seekPreviewTime.innerText = NeauangleVideo.UTIL.formatSecondsToColons(seekSeconds);
    }
})

progressBarBackground.addEventListener('mouseleave', (e) => {
    mouseIsOverProgressBar = false;
    seekPreviewTime.style.opacity = 0;
})

function getMouseSeekProportionAndRelativeX(){
    if (currentVideoInfo && currentGlobalMouseCoords){
        const relativeX = currentGlobalMouseCoords.x - progressBarBackground.getBoundingClientRect().x;
        const proportionX = relativeX / progressBarBackground.getBoundingClientRect().width;
        let seekSeconds = proportionX * currentVideoInfo.durationSeconds;
        if (seekSeconds >= currentVideoInfo.durationSeconds){
            seekSeconds = currentVideoInfo.durationSeconds - 1;
        } else if (seekSeconds < 0){
            seekSeconds = 0;
        } 
        return {seekSeconds, relativeX, proportionX}
    }
    return {seekSeconds: 0, relativeX: 0, proportionX: 0};
    
}





progressBarBackground.addEventListener('click', async (e) => {
    if (state === STATE.PLAYING || state === STATE.PAUSED || state == STATE.PRELOADED){
        if (state == STATE.PRELOADED){
            changeState(STATE.PAUSED); //needed so when we return from seek, we dont go to PRELOADED state
        }
        let seekSeconds = 0;
        if (seekPreviewTime.innerText){
            const fields = seekPreviewTime.innerText.split(':');
            seekSeconds += Number(fields[fields.length - 1]) + Number(fields[fields.length - 2]) * 60;
            if (fields.length > 2){
                seekSeconds += Number(fields[fields.length - 3]) * 60 * 60;
            }
        } else {
            seekSeconds = getMouseSeekProportionAndRelativeX().seekSeconds;
        }
        seek(seekSeconds);
    }

});




















function updateVideoProgress(currentSeconds){
    const thisTimeString = NeauangleVideo.UTIL.formatSecondsToColons(currentSeconds) 
        + '/' + NeauangleVideo.UTIL.formatSecondsToColons(currentVideoInfo.durationSeconds);
    if (currentProgressTimeString !== thisTimeString){
        progressTime.innerText = thisTimeString;
        currentProgressTimeString = thisTimeString;
        let currentBufferProgressPercent = 100 * ((highBufferThresholdSeconds - lowBufferThresholdSeconds)/currentVideoInfo.durationSeconds);
        progressBarForeground.style.width = `${currentBufferProgressPercent}%`;
        currentProgressPercent = (currentSeconds / currentVideoInfo.durationSeconds) * 100;
        currentTimeMarker.style.left = `${currentProgressPercent}%`;
    }

    for (let position of Object.keys(subtitleTreeInfo)){
        for (let language of Object.keys(subtitleTreeInfo[position])){
            const subtitleContainer = subtitleTreeInfo[position][language].container;
            let entriesToCarryOn = [];
            for (let i = 0; i < subtitleTreeInfo[position][language].currentEntries.length; ++i){
                const entry = subtitleTreeInfo[position][language].currentEntries[i];
                const offsetSeconds = subtitleTracks[language].offsetSeconds;
                if (currentSeconds + offsetSeconds < entry.startTimeSeconds){
                    //(doesn't get re-added)
                } else if (currentSeconds + offsetSeconds >= entry.endTimeSeconds){
                    //we default to tracking the japanese because there are many cases where there might be
                    //multiple english lines per japanese line. 
                    if ((language === 'jpn' || !subtitleTracks['jpn'].exists
                    || subtitleTreeInfo['bottom']['jpn'].container.style.display === 'none')
                    && keepToCurrentSubtitleBecauseMouseOverSubtitles === subtitleContainer.parentElement){
                        if (state !== STATE.SEEKING){
                            videoPlayer.pause();
                            seek(currentSeekSeconds-0.1);
                        }
                        return;
                    } else {
                        //console.log(subtitleContainer, subtitleContainer.parentElement, keepToCurrentSubtitleBecauseMouseOverSubtitles);
                    }
                } else {
                    entriesToCarryOn.push(entry)
                }
            }
            let newText = "";
            subtitleTreeInfo[position][language].currentEntries = entriesToCarryOn;
            for (let i = 0; i < entriesToCarryOn.length; ++i){
                if (i > 0){
                    newText += "<br>";
                }
                newText+= entriesToCarryOn[i].dialogue;
            }
            if (newText !== subtitleContainer.innerHTML){
                subtitleContainer.innerHTML = newText;

            }

        }
    }

    for (let subtitleTrack of Object.values(subtitleTracks)){
        if (subtitleTrack.exists){
            for (let i = 0; i < subtitleTrack.entries.length; ++ i){
                const entry = subtitleTrack.entries[i];
                if (currentSeconds + subtitleTrack.offsetSeconds >= entry.startTimeSeconds 
                && currentSeconds  + subtitleTrack.offsetSeconds <= entry.endTimeSeconds){
                    const language = subtitleTrack.language;
                    const position = (entry.an === '8' || entry.a === '6') ? 'top' : 'bottom';
                    const subtitleContainer = subtitleTreeInfo[position][language].container;
                    //we default to tracking the japanese because there are many cases where there might be
                    //multiple english lines per japanese line. 
                    if (!(keepToCurrentSubtitleBecauseMouseOverSubtitles === subtitleContainer.parentElement
                    && (language === 'jpn' || !subtitleTracks['jpn'].exists
                    || subtitleTreeInfo['bottom']['jpn'].container.style.display === 'none'))){
                        const currentEntries = subtitleTreeInfo[position][language].currentEntries;
                        if (subtitleContainer.innerHTML.indexOf(entry.dialogue) === -1){
                            if (!currentEntries.includes(entry)){
                                currentEntries.push(entry);
                            }
                            
                            if (subtitleContainer.innerHTML.length > 0){
                                subtitleContainer.innerHTML += "<br>";
                            }
                            subtitleContainer.innerHTML += entry.dialogue + "";
                            subtitleTrack.lastActiveIndexCache = i;
                            emitEvent(NeauangleVideo.EVENTS.NEW_CURRENT_SUBTITLE_ENTRY, {language, entry});
                        }
                    } 
                }
            } 
        }
    }
}











const keyToFunction = {
    "Space": (ev) => {
        if (state === STATE.PLAYING || state === STATE.PAUSED){
            if (keepToCurrentSubtitleBecauseMouseOverSubtitles){
                keepToCurrentSubtitleBecauseMouseOverSubtitles = null;
                videoPlayer.pause();
            } else {
                togglePausePlay();
            }
        }
    },

    "ArrowLeft": (ev) => {
        seek(Math.max(Math.ceil(lowBufferThresholdSeconds), currentSeekSeconds-5));
    },
    "ArrowRight": (ev) => {
        seek(Math.min(Math.floor(highBufferThresholdSeconds), currentSeekSeconds+5));
    },
    "KeyA": async (ev) => {
        let language = subtitleTracks['jpn'].exiss ? 'jpn' : 'eng';
        if (subtitleTracks[language].exists){       
            let indexToGoTo = subtitleTracks[language].lastActiveIndexCache;
            let entry = subtitleTracks[language].entries[indexToGoTo];
            //remember we add 0.1 when we jump, so 0.2 here gives 0.1-second
            //window to jump back to the PREVIOUS subtitle. 
            //also, we're counteracting the offset time here
            if (currentSeekSeconds < (entry.startTimeSeconds - subtitleTracks[language].offsetSeconds) + 0.2){
                if (indexToGoTo > 0){
                    indexToGoTo -= 1;
                }
            }
            await seek(subtitleTracks[language].entries[indexToGoTo].startTimeSeconds - subtitleTracks[language].offsetSeconds +0.1);
            if (keepToCurrentSubtitleBecauseMouseOverSubtitles){
                videoPlayer.play();
            }
        }
    },
    "KeyD": (ev) => {
        let language = subtitleTracks['jpn'].exiss ? 'jpn' : 'eng';
        if (subtitleTracks[language].exists){        
            const indexToGoTo = subtitleTracks[language].lastActiveIndexCache + 1;
            if (indexToGoTo < subtitleTracks[language].entries.length){
                seek(subtitleTracks[language].entries[indexToGoTo].startTimeSeconds - subtitleTracks[language].offsetSeconds +0.1);
            }
        }
    },
}

document.addEventListener('keydown', (e) => {
    if (keyToFunction.hasOwnProperty(e.code)) {    
        if (document.activeElement.nodeName.toLowerCase() != "input"
        && document.activeElement.nodeName.toLowerCase() != "textarea"
        && document.activeElement.nodeName.toLowerCase() != "button") {
            e.preventDefault();
            if (state === STATE.PLAYING || state === STATE.PAUSED){
                keyToFunction[e.code](e);
            }
        }
    }
});





function seekToSubtitleIndex(language, index){
    const subtitleTrack = subtitleTracks[language];
    if (subtitleTrack && subtitleTrack.entries.length > index){
        seek(subtitleTrack.entries[index].startTimeSeconds - subtitleTrack.offsetSeconds); 
    } else {
        emitEvent(NeauangleVideo.EVENTS.ERROR, {type: NeauangleVideo.ERRORS.ERROR_SEEKING_TO_SUBTITLE, error: "no matching track or index out of bounds"});
    }
}















window.bridge.setHandlerForSelectSubtitleStreamsRequest(handleSelectSubtitleStreamsRequest);

if (initFilePath){
    initStream(initFilePath);
}

video.addSubtitleTrack = addSubtitleTrack;
video.toggleSubtitleIsActive = toggleSubtitleIsActive;
video.setSubtitleBackgroundColour = setSubtitleBackgroundColour;
video.subtitlesExist = language => subtitleTracks[language].exists;
video.setSubtitleOffsetSeconds = setSubtitleOffsetSeconds;
video.getVideoInfo = () => currentVideoInfo;
video.seekToSubtitleIndex = seekToSubtitleIndex;
video.setSubtitleFontSize = setSubtitleFontSize;

return video;

};


