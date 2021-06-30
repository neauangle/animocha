import * as Templates from './templates.js';
import * as Search from './search.js';
import { createModalController } from './modal.js';

const mainContainer = document.getElementById('main-container');
const leftCell = document.getElementById('left-cell');
const rightCell = document.getElementById('right-cell');
const leftRightSeparator = document.getElementById("left-right-separator");
const dictionaryPanel =  document.getElementById('dictionary-panel');
const subtitlesPanel =  document.getElementById('subtitles-panel');
let subtitleRowsContainer = document.getElementById('subtitle-rows-container');
const tooltipShell = document.getElementById("tooltip-shell");
const tooltip = document.getElementById("tooltip");
const dictionarySubtitlesSeparator = document.getElementById("dictionary-subtitles-separator");
const videoPlayerPanel = document.getElementById('video-player-panel');


const bottomPanel = document.getElementById('bottom-panel');
const bottomPanelSubtitleControls = {'eng': {}, 'jpn': {}}
const eyeOpenSVGPath = `img/icons/material-design/eye.svg`;
const eyeClosedSVGPath = `img/icons/material-design/eye-off.svg`;
const fullScreenInput = document.getElementById("full-screen-input");
const convertButton = document.getElementById("convert-video-button");
const convertProgress = document.getElementById("convert-video-progress");
const backgroundAlphaInput = document.getElementById('subs-background-alpha-input');
const clearSettingsButton = document.getElementById('clear-file-cache-button');
const aboutButton = document.getElementById("about-button");
const aboutModal = document.getElementById("about-modal");
const modalController = createModalController(
    document.getElementById("modal-background"),
    {button: aboutButton, modal: aboutModal},
);

const userData = await window.bridge.getUserData();

let mostRecentJapaneseSubtitleEntry;
let currentVideoFileName;
let videoContainer;
let video
let mouseIsOverSubtitlesScroller;
let tooltipOn = false;
let repositioningDictionarySubtitlesSeparator = false;
let repositioningLeftRightSeparator = false;
let mousePos = {x: 0, y: 0};

let dictP = Number(userData["dictionaryPanelProportion"].slice(0,-1));
dictionaryPanel.style.height = dictP+'%';
subtitlesPanel.style.height = (100-dictP) + '%';
let dictionarySubtitlesSeparatorNewY = 0;

let leftP = Number(userData["leftCellProportion"].slice(0,-1));
console.log(leftP);
leftCell.style.width = leftP+'%';
rightCell.style.width = (100-leftP) + '%';
let leftRightSeparatorNewX = 0;


for (const a of document.getElementsByTagName('a')){
    a.addEventListener('click', e=> window.bridge.openURL(a.getAttribute('href')));
    setTooltip(a, a.getAttribute('href'));
}

document.addEventListener('mousemove', (ev) => {   
    let delta = {y: ev.y - mousePos.y, x: ev.x - mousePos.x}
    mousePos = ev;
    if (tooltipShell.style.opacity && tooltipShell.style.opacity != '0'){
        tooltipShell.style.left = ev.x + "px";
        tooltipShell.style.top = (ev.y - tooltipShell.getBoundingClientRect().height) + "px";
    }

    if (repositioningDictionarySubtitlesSeparator){
        dictionarySubtitlesSeparatorNewY += delta.y;
        let yp =  100*(dictionarySubtitlesSeparatorNewY / rightCell.getBoundingClientRect().height);
        dictionaryPanel.style.height = yp + '%';
        subtitlesPanel.style.height = (100-yp) + '%';
    }

    if (repositioningLeftRightSeparator){
        leftRightSeparatorNewX += delta.x;
        let xp =  100*(leftRightSeparatorNewX / mainContainer.getBoundingClientRect().width);
        leftCell.style.width = xp + '%';
        rightCell.style.width = (100-xp) + '%';
    }

});
document.addEventListener('mouseup', () => {
    if (repositioningDictionarySubtitlesSeparator){
        repositioningDictionarySubtitlesSeparator = false;
        dictionarySubtitlesSeparator.classList.remove('selected');
        userData["dictionaryPanelProportion"] =  dictionaryPanel.style.height;
        saveOutUserData();
    }
    if (repositioningLeftRightSeparator){
        repositioningLeftRightSeparator = false;
        leftRightSeparator.classList.remove('selected');
        userData["leftCellProportion"] =  leftCell.style.width;
        saveOutUserData();
    }
    let element = document.getSelection().anchorNode;
    while (element !== document.body){
        if (!element || element === dictionaryPanel || element === aboutModal || (video && element === bottomPanel)){
            return;
        }
        element = element.parentElement;
    }
    const selection = document.getSelection().toString();
    document.getSelection().empty();
    if (selection){
        dictionaryPanel.innerHTML = Search.getHTMLStringFromSearchResult(Search.searchWord(selection));
       for (element of document.getElementsByClassName('search-result-vocab-entry-sense-header')){
            if (element.hasAttribute('title')){
                const tooltip = element.getAttribute('title').split('\n').join('<br/>');
                console.log(element.getAttribute('title'), tooltip);
                setTooltip(element, tooltip, {textAlign: 'left'});
                element.removeAttribute('title');
            }
        }
    }

    
})


document.getElementById('dev-tools-button').addEventListener("click", event => { window.bridge.enableDevTools();});

dictionarySubtitlesSeparator.addEventListener('mousedown', e => {
    repositioningDictionarySubtitlesSeparator = true;
    dictionarySubtitlesSeparatorNewY = dictionarySubtitlesSeparator.offsetTop + 0.5 * dictionarySubtitlesSeparator.getBoundingClientRect().height;
    dictionarySubtitlesSeparator.classList.add('selected');
})

leftRightSeparator.addEventListener('mousedown', e => {
    repositioningLeftRightSeparator = true;
    leftRightSeparatorNewX = leftRightSeparator.offsetLeft + 0.5 * leftRightSeparator.getBoundingClientRect().width;
    leftRightSeparator.classList.add('selected');
})




function resetSubtitlesPanel(){
    const parent = subtitleRowsContainer.parentElement;
    subtitleRowsContainer.remove();
    subtitleRowsContainer = document.createElement('div');
    subtitleRowsContainer.id = 'subtitle-rows-container';
    parent.appendChild(subtitleRowsContainer);
}





function saveOutUserData(){
    window.bridge.updateUserData(userData);
}

async function setSubtitleFile(language, filePath){
    disableOpenSubtitleButton(bottomPanelSubtitleControls[language]);
    const subtitleTrack = await window.bridge.getSubtitleTrackFromFile(filePath, language);
    if (subtitleTrack){
        video.addSubtitleTrack(subtitleTrack)
    } else{
        enableOpenSubtitleButton(bottomPanelSubtitleControls[language]);
        console.log('error: invalid subtitle file:', filePath)
    };
}

subtitleRowsContainer.addEventListener('mouseenter', ev => {mouseIsOverSubtitlesScroller = true;});
subtitleRowsContainer.addEventListener('mouseleave', ev => {mouseIsOverSubtitlesScroller = false;});


function createNew(initFilePath){
    if (videoContainer){
        videoContainer.remove();
    }
    videoContainer = document.createElement('div');
    videoContainer.style.height = '100%';
    videoPlayerPanel.appendChild(videoContainer);
    video = NeauangleVideo.create(videoContainer, initFilePath);
    resetBottomPanel();
    resetSubtitlesPanel();

    video.addEventListener(NeauangleVideo.EVENTS.ERROR, (event) => {
        console.log('uh oh spaghettio', event.data.type, event.data.error);
        if (event.data.type === NeauangleVideo.ERRORS.ERROR_LOADING_STREAM){
            createNew();
        }
    });
    video.addEventListener(NeauangleVideo.EVENTS.ABOUT_TO_LOAD_VIDEO, (event) => {
        currentVideoFileName = event.data.filePath.split(/[\\/]/).pop();
        console.log('updated currentVideoFileName', currentVideoFileName)
        console.log(currentVideoFileName);
        if (!userData.files[currentVideoFileName]){
            //no need to save out yet
            userData.files[currentVideoFileName] = {
                subtitles: {
                    jpn: {
                        offsetSeconds: 0,
                        filePath: null,
                        index: null,
                        choiceIndex: null,
                    },
                    eng: {
                        offsetSeconds: 0,
                        filePath: null,
                        index: null,
                        choiceIndex: null,
                    }
                },
            }
        }
    });
    video.addEventListener(NeauangleVideo.EVENTS.SUBTITLE_CHOICE_AVAILABLE, (event) => {
        if (userData.files[currentVideoFileName]){
            const engChoiceIndex = userData.files[currentVideoFileName].subtitles.eng.choiceIndex;
            const jpnChoiceIndex = userData.files[currentVideoFileName].subtitles.jpn.choiceIndex;
            if (engChoiceIndex !== null && event.data.args.eng && event.data.args.eng.length > engChoiceIndex){
                event.data.args.eng = [event.data.args.eng[engChoiceIndex]]
            }
            if (jpnChoiceIndex !== null && event.data.args.jpn && event.data.args.jpn.length > jpnChoiceIndex){
                event.data.args.jpn = [event.data.args.eng[jpnChoiceIndex]]
            }
        }
    });
    video.addEventListener(NeauangleVideo.EVENTS.SUBTITLE_CHOICE_MADE, (event) => {
        let dirty = false;
        if (userData.files[currentVideoFileName]){
            if (event.data.choiceIndexes.eng !== null){
                userData.files[currentVideoFileName].subtitles.eng.choiceIndex = event.data.choiceIndexes.eng;
                dirty = true;
            }
            if (event.data.choiceIndexes.jpn !== null){
                userData.files[currentVideoFileName].subtitles.jpn.choiceIndex = event.data.choiceIndexes.jpn;
                dirty = true;
            }
            if (dirty){
                saveOutUserData();
            }
        }
    });

    video.addEventListener(NeauangleVideo.EVENTS.VIDEO_LOADED, (event) => {
        clearSettingsButton.disabled = false;
        convertButton.classList.remove("disabled");
        const subtitlesHandled = {eng: false, jpn: false};
        const subtitleInfo = userData.files[currentVideoFileName].subtitles;
        for (let language of Object.keys(subtitleInfo)){
            const filePath = subtitleInfo[language].filePath;
            if (filePath){
                subtitlesHandled[language] = true;
                setSubtitleFile(language, filePath);
            } else {
                if (!video.subtitlesExist(language)){
                    enableOpenSubtitleButton(bottomPanelSubtitleControls[language]);
                }
            }
            const offsetSeconds = subtitleInfo[language].offsetSeconds;
            if (offsetSeconds){
                video.setSubtitleOffsetSeconds(language, offsetSeconds);
            }
        }
    });
   

    video.addEventListener(NeauangleVideo.EVENTS.SUBTITLE_TRACK_READY, async event => {
        const subtitleTrack = event.data.subtitleTrack;
        enableSubtitles(subtitleTrack);
        if (subtitleTrack.language === 'jpn'){
            console.log(subtitleTrack);
            for (let i = 0; i < subtitleTrack.entries.length; ++i){
                const entry = subtitleTrack.entries[i];
                const subtitleRow = Templates.getSubttitleRow(entry.dialogue, entry);
                const playFromButton = subtitleRow.getElementsByTagName('img')[0];
                playFromButton.addEventListener('click', (ev) => {
                    video.seekToSubtitleIndex('jpn', i);
                });
                setTooltip(playFromButton, NeauangleVideo.UTIL.formatSecondsToColons(entry.startTimeSeconds - subtitleTrack.offsetSeconds));
                subtitleRowsContainer.appendChild(subtitleRow);
            }
            document.getElementById("scrolling-subs-font-size-input").disabled = false;
        }

        if (subtitleTrack.filePath !== userData.files[currentVideoFileName].subtitles[subtitleTrack.language].filePath
        || subtitleTrack.index !== userData.files[currentVideoFileName].subtitles[subtitleTrack.language].index){
            userData.files[currentVideoFileName].subtitles[subtitleTrack.language].filePath = subtitleTrack.filePath;
            userData.files[currentVideoFileName].subtitles[subtitleTrack.language].index = subtitleTrack.index;
            saveOutUserData();
        }
    });

    video.addEventListener(NeauangleVideo.EVENTS.NEW_CURRENT_SUBTITLE_ENTRY, event => {
        if (event.data.language === 'jpn' && subtitleRowsContainer.children.length > event.data.entry.index){
            if (mostRecentJapaneseSubtitleEntry){
                subtitleRowsContainer.children[mostRecentJapaneseSubtitleEntry.index].classList.remove('most-recent-subtitle');
            }
            mostRecentJapaneseSubtitleEntry = event.data.entry;
            subtitleRowsContainer.children[mostRecentJapaneseSubtitleEntry.index].classList.add('most-recent-subtitle');
            if (!mouseIsOverSubtitlesScroller){
                let indexToScrollTo = mostRecentJapaneseSubtitleEntry.index - 4;
                indexToScrollTo = indexToScrollTo < 0 ? 0 : indexToScrollTo;
                subtitleRowsContainer.children[indexToScrollTo].scrollIntoView(true);
            }
        }
    });
    video.addEventListener(NeauangleVideo.EVENTS.VIDEO_LOAD_REQUEST, (event) => {
        createNew(event.data.filePath);
    });
}











function setTooltip(element, message, options){
    if (element.hasAttribute('tooltip')){
        element.setAttribute('tooltip', message);
        return
    }
    element.setAttribute('tooltip', message);
    element.addEventListener('mouseenter', (e) => {
        if (!element.classList.contains('disabled')){
            if (options && options.textAlign){
                tooltip.style.textAlign = options.textAlign;
            } else {
                tooltip.style.textAlign = 'center';
            }
            if (options && options.bottomPadding){
                tooltipShell.style.paddingBottom = options.bottomPadding;
            } else {
                tooltipShell.style.paddingBottom = '10px';
            }
            
            tooltip.innerHTML = element.getAttribute('tooltip');
            if (!tooltipOn){
                NeauangleVideo.UTIL.fadeObjectInSuperFast(tooltipShell);
                tooltipOn = true;
            }  
        }
        
    });
    element.addEventListener('mouseleave', (e) => {
        if (tooltipOn){
            NeauangleVideo.UTIL.fadeObjectOutSuperFast(tooltipShell);
            tooltipOn = false;
        }
    });
}


function disableOpenSubtitleButton(controlsSet){
    controlsSet.fileButton.disabled = true;
    controlsSet.fileButton.classList.add('disabled');
    controlsSet.fileInput.disabled = true;
}
function enableOpenSubtitleButton(controlsSet){
    controlsSet.fileButton.disabled = false;
    controlsSet.fileInput.disabled = false;
    controlsSet.fileButton.classList.remove('disabled');
}


function enableSubtitles(subtitleTrack){
    const language = subtitleTrack.language;
    bottomPanelSubtitleControls[language].fileButton.style.display = 'none';
    bottomPanelSubtitleControls[language].visibilityToggle.style.display = 'flex';
    bottomPanelSubtitleControls[language].visibilityToggle.src = eyeOpenSVGPath;
    bottomPanelSubtitleControls[language].offsetInput.disabled = false;
    bottomPanelSubtitleControls[language].fontSizeInput.disabled = false;
    backgroundAlphaInput.disabled = false;
}



function resetBottomPanel(){
    backgroundAlphaInput.disabled = true;
    backgroundAlphaInput.value= userData['subtitleBackgroundAlpha'];  
    clearSettingsButton.disabled = true;
    for (let language of Object.keys(bottomPanelSubtitleControls)){
        bottomPanelSubtitleControls[language].fileButton.style.display = 'flex';
        disableOpenSubtitleButton(bottomPanelSubtitleControls[language]);
        bottomPanelSubtitleControls[language].visibilityToggle.style.display = 'none';
        bottomPanelSubtitleControls[language].offsetInput.value = "0";
        bottomPanelSubtitleControls[language].offsetInput.disabled = true;
        bottomPanelSubtitleControls[language].fontSizeInput.value = userData[language + 'FontSize'];
        bottomPanelSubtitleControls[language].fontSizeInput.disabled = true;
    }

    for (let language of ['eng', 'jpn']){
        video.setSubtitleBackgroundColour(language, "#000000", Number(userData['subtitleBackgroundAlpha'])/100);
        video.setSubtitleFontSize(language, userData[language + 'FontSize']);
    }
}

setTooltip(fullScreenInput, "You can also toggle with F11", {bottomPadding: '15px'});

fullScreenInput.addEventListener('change', e => {
    window.bridge.setFullScreen(fullScreenInput.checked);
})

setTooltip(convertButton, "Convert to a natively compatible format<br>(and mux current subtitles)", {bottomPadding: '15px'});

const scrollingSubsFontSizeInput = document.getElementById("scrolling-subs-font-size-input");
setTooltip(scrollingSubsFontSizeInput, "Font size");
document.querySelector(':root').style.setProperty('--scrolling-subtitles-font-size', userData['scrollingSubtitleFontSize']);
scrollingSubsFontSizeInput.value = userData['scrollingSubtitleFontSize'];
scrollingSubsFontSizeInput.addEventListener('change', event => {
    let unitString = scrollingSubsFontSizeInput.value;
    if (['1','2','3','4','5','6','7','8','9','0'].includes(unitString[unitString.length-1])){
        unitString += 'px';
    }
    document.querySelector(':root').style.setProperty('--scrolling-subtitles-font-size', unitString);
    userData['scrollingSubtitleFontSize'] = unitString;
    console.log(unitString);
    saveOutUserData();
});

setTooltip(backgroundAlphaInput, "Background transparency", {bottomPadding: '15px'});
backgroundAlphaInput.addEventListener('input', event => {
    for (let language of ['eng', 'jpn']){
        video.setSubtitleBackgroundColour(language, "#000000", backgroundAlphaInput.value / 100);
    }
});
backgroundAlphaInput.addEventListener('change', event => {
    userData["subtitleBackgroundAlpha"] = backgroundAlphaInput.value;
    saveOutUserData();
});

setTooltip(clearSettingsButton, "Clear subtitle file and offset<br>info for this video file", {bottomPadding: '15px'});
clearSettingsButton.addEventListener('click', e => {
    delete userData.files[ficurrentVideoFileNameleName];
    clearSettingsButton.disabled = true;
    clearSettingsButton.innerHTML = "Cleared";
    saveOutUserData();
})


for (let language of Object.keys(bottomPanelSubtitleControls)){
    const fileButton = document.getElementById(`subs-${language}-open-button`);
    const fileInput = document.getElementById(`subs-${language}-open-input`);
    const visibilityToggle = document.getElementById(`subs-${language}-visiblity-toggle`);
    const fontSizeInput = document.getElementById(`subs-${language}-font-size-input`); 
    const offsetInput = document.getElementById(`subs-${language}-offset-input`);
    
    setTooltip(fontSizeInput, "Font size", {bottomPadding: '15px'});
    setTooltip(offsetInput, "Timing offset (s)<br>+ve to speed up", {bottomPadding: '15px'});
   

    bottomPanelSubtitleControls[language] = {
        fileButton, fileInput, visibilityToggle,
        fontSizeInput, offsetInput 
    }

    visibilityToggle.addEventListener('click', event => {
        const isActive = video.toggleSubtitleIsActive(language);
        visibilityToggle.src = isActive ? eyeOpenSVGPath : eyeClosedSVGPath;
    });
    fontSizeInput.addEventListener('change', event => {
        let unitString = fontSizeInput.value;
        if (['1','2','3','4','5','6','7','8','9','0'].includes(unitString[unitString.length-1])){
            unitString += 'px';
        }
        video.setSubtitleFontSize(language, unitString);
        userData[event.data.language + 'FontSize'] = unitString;
        saveOutUserData();
    });
    offsetInput.addEventListener('change', event => {
        let offsetSecs = Number(NeauangleVideo.UTIL.formatColonsToSeconds(offsetInput.value));
        if (isNaN(offsetSecs)){
            offsetSecs = 0;
        }
        video.setSubtitleOffsetSeconds(language, offsetSecs);
        const subtitleTrack = event.data.subtitleTrack;
        if (subtitleTrack.language === 'jpn'){
            for (let i = 0; i < subtitleRowsContainer.children.length; ++i){
                const playFromButton = subtitleRowsContainer.children[i].getElementsByTagName('img')[0];
                const entry = subtitleTrack.entries[i];
                setTooltip(playFromButton, NeauangleVideo.UTIL.formatSecondsToColons(entry.startTimeSeconds - subtitleTrack.offsetSeconds));
            }
        }

        if (subtitleTrack.offsetSeconds !== userData.files[currentVideoFileName].subtitles[subtitleTrack.language].offsetSeconds){
            userData.files[currentVideoFileName].subtitles[subtitleTrack.language].offsetSeconds = subtitleTrack.offsetSeconds;
            saveOutUserData();
        }
    });
   
    fileInput.addEventListener('change', async event => {
        setSubtitleFile(language, fileInput.files[0].path);
    });
}




convertButton.addEventListener("click", async ev => {
    if (!convertButton.classList.contains("disabled")){
        convertButton.classList.add("disabled");
        if (video.getVideoInfo()){
            //we pass the subtitle tracks ourselves because one (or both) of them might be
            //from files, therefore not even guessable based on video info. Let alone
            //the problem of multiple tracks of the same language.
            await window.bridge.convertFileToHTMLFriendly(
                video.getVideoInfo(), video.getSubtitleTracks(), handleConversionProgress
            );
        }
        convertButton.classList.remove("disabled");
        convertProgress.innerText = '';
    }
})

function handleConversionProgress(currentSeconds, durationSeconds){
    convertProgress.innerText = `${Math.round((100*currentSeconds) / durationSeconds)}%`;
}







document.addEventListener('keydown', (e) => {
    if (e.code=== "Escape"){
        fullScreenInput.checked = false;
        window.bridge.setFullScreen(fullScreenInput.checked);
    }
    if (e.code=== "F11"){
        fullScreenInput.checked = !fullScreenInput.checked;
        window.bridge.setFullScreen(fullScreenInput.checked);
    }
});








Search.init((proportionDone) => {console.log(proportionDone);});
createNew();