const childProcess  = require("child_process");
const subParser = require('./sub-parser');
const os = require('os');
const fs = require('fs');
const main = require('./main');
const { dialog } = require("electron");
const path = require("path");

const FFMPEG_PATH = './ffmpeg';
const FFPROBE_PATH = './ffprobe';

let ffmpegProcess;

function getSecondsFromTimeStamp(timestamp){
    const groups = timestamp.split(':');
    return Number(groups[0]) * 60 * 60 + Number(groups[1]) * 60 + Number(groups[2]);
}


async function convertFileToHTMLFriendly(window, videoInfo, subtitleTracks=[]){
    let videoStreamIndex = 0;
    if (videoInfo.videoStreams.length > 0){
        videoStreamIndex = videoInfo.videoStreams[0].index;
    };
    let audioStreamIndex = videoInfo.audioStreams[0].index;
    for (let audioStream of videoInfo.audioStreams){
        if (audioStream.language === 'jpn'){
            audioStreamIndex = audioStream.index;
            break;
        }
    }

    let pathInfo=  path.parse(videoInfo.filePath);
    let saveAsGuess = pathInfo.name + '(html5)' + pathInfo.ext;
    let toFilepath = dialog.showSaveDialogSync(window, {
        title: "Convert Video",
        defaultPath: saveAsGuess,
        buttonLabel: "Save",
        filters :[{name: 'Movies', extensions: ['mkv', 'mp4']}],
    })
    if (toFilepath){
        let ffmpegArgs = ['-y', '-i', videoInfo.filePath];
        let i = 1;
        let maps = ['-map', `0:${videoStreamIndex}`, '-map', `0:${audioStreamIndex}`];
        for (let subtitleTrack of subtitleTracks){
            if (subtitleTrack.exists){
                //factoring in the offset would be nice, but I can't get it to stop from
                //dodging up the timing of the actual video. Like, with an offset of 9.5, which is made -9.5
                //here, the video will start around 9.5 seconds in, even in vlc player. It must mess with the internal timings
                //or something.
            /*  if (subtitleTrack.filePath !== videoInfo.filePath){
                    ffmpegArgs.push('-itsoffset');
                    ffmpegArgs.push((-subtitleTrack.offsetSeconds).toString());
                    ffmpegArgs.push('-ss');//nope, this dont work
                    ffmpegArgs.push((subtitleTrack.offsetSeconds).toString());
                } */
                ffmpegArgs.push('-i');
                ffmpegArgs.push(subtitleTrack.filePath ? subtitleTrack.filePath : videoInfo.filePath);
                maps.push('-map');
                maps.push(`${i}:${subtitleTrack.index}`);
                //I think -metadata is based on OUTPUT stream #. video=0,audio=1,so i (which starts at 1) +1
                maps.push(`-metadata:s:${i+1}`);
                maps.push(`language=${subtitleTrack.language}`);
                i += 1;   
            }
        }
        ffmpegArgs = ffmpegArgs.concat(maps).concat(['-preset', 'ultrafast', toFilepath]);
        console.log(ffmpegArgs);
        let convertProcess = childProcess.spawn(FFMPEG_PATH, ffmpegArgs);
        let durationSeconds;
        return new Promise((resolve, reject) => {
            convertProcess.on ('close', ( code ) =>{
                return resolve();
            });
            convertProcess.stderr.on('data', (data) =>{
                const output = data.toString("utf-8");
                if (durationSeconds){
                    const timeIndex = output.indexOf("time=");
                    if (timeIndex >= 0){
                        const timeString = output.slice(
                            timeIndex+5, output.indexOf(" ", timeIndex)
                        ).trim();
                        const currentSeconds = getSecondsFromTimeStamp(timeString);
                        
                        main.passIPCToClientSide('conversion-update', currentSeconds, durationSeconds);
                    }
                } else {
                    const durationIndex = output.indexOf("DURATION");
                    if (durationIndex >= 0){
                        const durationString = output.slice(
                            output.indexOf(":", durationIndex)+1, output.indexOf("\n", durationIndex)
                        ).trim();
                        durationSeconds = getSecondsFromTimeStamp(durationString);
                    }
                }

            });
        });
    }

}




    
async function getSubtitleTrackFromFile(filePath, language, newlineInDialogue='<br>'){
    let subtitleTrack = {
        index: 0, //this way there's no special case when we convert to html5 video and mux in subtitles
        language: language, 
        filePath: filePath, 
        entries: await getSubtitleEntries(filePath, 0, newlineInDialogue)
    };
    if (!subtitleTrack.entries){
        return null;
    }
    return subtitleTrack;
}


async function getSubtitleEntries(filepath, streamIndex, newlineInDialogue='<br>'){
    let subtitles;//'-c:s', 'text' to remove html and positioning tags from srt files
    let process = childProcess.spawn(FFMPEG_PATH, [ '-i', filepath, '-map', `0:${streamIndex}`, '-f', 'ass', '-']);
    process.stdout.on ('data', ( data ) =>{
        if (!subtitles){
            subtitles = '';
        }
        subtitles += data.toString('utf-8') ;  
    });
    let promise = new Promise((resolve, b) => {
        process.stdout.on ('close', ( code ) =>{
            if (subtitles){
                subtitles = subParser.fromASS(subtitles, newlineInDialogue);
            }
            resolve(subtitles);
        });
    });
    
    
    return promise;
}

function getVideoInfo(filepath){
    let jsonString = '';
    let process = childProcess.spawn(FFPROBE_PATH, [ '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', '-i', filepath])    
    process.stdout.on ('data', ( data ) =>{
        jsonString += data.toString('utf-8');
    });
    let promise = new Promise((resolve, error) => {
        process.stdout.on ('close', ( code ) =>{
            let json = JSON.parse(jsonString);
            if (Object.keys(json).length === 0){
                return error(`Invalid file "${filepath}"`);
            }
            let ret = {full: json, filePath: filepath, fileName: path.basename(filepath), durationSeconds: Number(json.format.duration), videoStreams: [], audioStreams: [], subtitleStreams: []};
            for (let streamInfo of json.streams){
                if (streamInfo.codec_type === 'video'){
                    ret.videoStreams.push({
                        index: streamInfo.index, 
                        codecName: streamInfo.codec_name
                    });
                } else  if (streamInfo.codec_type === 'audio'){
                    ret.audioStreams.push({
                        index: streamInfo.index, 
                        codecName: streamInfo.codec_name, 
                        language: streamInfo.tags && streamInfo.tags.language
                    });
                } else  if (streamInfo.codec_type === 'subtitle'){
                    ret.subtitleStreams.push({
                        index: streamInfo.index, 
                        codecName: streamInfo.codec_name, 
                        language: streamInfo.tags && streamInfo.tags.language,
                        title:  streamInfo.tags && streamInfo.tags.title
                    });
                } 
            }
            return resolve(ret);
        });
    });

    return promise;
}



let i = 0;

async function startLoadingStream(options){
    console.log('starting video stream...');
    if (ffmpegProcess){
        ffmpegProcess.kill(9)
    }
    ffmpegProcess = null;
    

    const tempDir = os.tmpdir() + '\\animisu\\';
    if (fs.existsSync(tempDir)) {
       fs.rmdirSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true }); //recursive because user might have deleted their temp folder
    const streamFile = tempDir + i.toString() + 'stream.m3u8'
    i += 1;

    let videoInfo = await getVideoInfo(options.path, true);
    console.log(videoInfo);
    let videoStreamIndex = 0;
    if (videoInfo.videoStreams.length > 0){
        videoStreamIndex = videoInfo.videoStreams[0].index;
    };
    let audioStreamIndex = videoInfo.audioStreams[0].index;
    for (let audioStream of videoInfo.audioStreams){
        if (audioStream.language === 'jpn'){
            audioStreamIndex = audioStream.index;
            break;
        }
    }


     let ffmpegArgs = ['-re',  '-ss', options.seekSeconds, '-i', options.path, 
        '-sc_threshold', '0',
        '-c:a', 'aac', '-c:v', 'libx264',
        '-preset', 'ultrafast', '-s', '720x540', '-sn', '-g', '2', '-f', 'hls', //g if GoupOfPictures count
        '-hls_list_size', '0', '-hls_allow_cache', '1', //we dont want to delete cache, 0 means infinite
        '-map', `0:${audioStreamIndex}`, '-map', `0:${videoStreamIndex}?`, // ? so we can handle audio only if no vid
       '-hls_flags', '+single_file','-hls_playlist_type', 'event', streamFile //single file is just... tidier
    ]; 


    console.log(ffmpegArgs);
    ffmpegProcess = childProcess.spawn(FFMPEG_PATH, ffmpegArgs);
    
    ffmpegProcess.stderr.on('data', ( data ) =>{
        console.log(data.toString('utf-8'));
    });     

    let subtitles;
    if (options.isFirstInit){
        let subtitleTracks = {'jpn': [], 'eng': []};
        for (let subtitleTrack of videoInfo.subtitleStreams){
            console.log('here', subtitleTrack.codecName);
            if (subtitleTrack.language === 'jpn' || subtitleTrack.language === 'eng'){
                //image-based
                if (subtitleTrack.codecName !== 'dvb_subtitle' 
                && subtitleTrack.codecName !== 'dvd_subtitle'       
                && subtitleTrack.codecName !== 'hdmv_pgs_subtitle'   
                && subtitleTrack.codecName !== 'xsub'   
                //I heard this was a pia to deal with so meh it's out
                && subtitleTrack.codecName !== 'eia_608'
                ){
                    subtitleTracks[subtitleTrack.language].push(subtitleTrack);
                }
            }
        }
        if (subtitleTracks['eng'].length > 1 || subtitleTracks['jpn'].length > 1){
            subtitleTracks = await main.passIPCToClientSide(
                'select-subtitle-streams-from-video', videoInfo.fileName, subtitleTracks
            );
        }
        subtitles = {};
        for (language of ['eng', 'jpn']){
            if (subtitleTracks[language].length > 0){
                subtitles[language] = subtitleTracks[language][0];
                subtitles[language].entries = getSubtitleEntries(options.path, subtitles[language].index);
            }
        }
        for (let subtitle of Object.values(subtitles)){
            subtitle.entries = await subtitle.entries;
        }

        main.passIPCToClientSide('subtitles-ready', subtitles);
        
        //these lists are almost assuredly not complete.
        const supportedFormats = ['mp4', 'move', 'ogg', 'webm', 'mpeg', 'mp3', 'wav', 'mkv'];
        const supportedVideoCodecs = ['h264', 'theora', 'vp8', 'vp9', 'flv1'];
        const supportedAudioCodecs = ['aac', 'flac', 'g711', 'g722', 'mp3', 'opus', 'vorbis', 'pcm_s24le', 'pcm_s16le'];
        let isSupportedWithoutFFMPEG = false;
        for (let format of supportedFormats){ 
            if (videoInfo.full.format.format_name.includes(format)){
                console.log('format ok', videoInfo.full.format.format_name);
                isSupportedWithoutFFMPEG = true;
                break;
            }
        }
        if (videoInfo.videoStreams.length > 0){ 
            const videoCodecName = videoInfo.videoStreams[0].codecName;
            if (!supportedVideoCodecs.includes(videoCodecName)){
                console.log("video not supported:", videoCodecName);
                isSupportedWithoutFFMPEG = false;
            } else {
                console.log("video supported:", videoCodecName);
            }
        }
        if (videoInfo.audioStreams.length > 0){
            const audioCodecName = videoInfo.audioStreams[0].codecName;
            if (!supportedAudioCodecs.includes(audioCodecName)){
                console.log("audio not supported:", audioCodecName);
                isSupportedWithoutFFMPEG = false;
            } else {
                console.log("audio supported:", audioCodecName);
            } 
        }  
        if (isSupportedWithoutFFMPEG){
            console.log('supported');
            if (ffmpegProcess){
                ffmpegProcess.kill();
            }
            return {streamPath: null, subtitles, videoInfo};
        }
        console.log('not supported - keeping ffmpeg')

    }
    
    
   // await  fileStreamPromise;
    let ms = 0;
    while (!fs.existsSync(streamFile)) {
        await wait(500);
        ms += 500;
        console.log('still waiting for ' + streamFile);
        if (ms > 7500){
            throw "Waited too long for ffmpeg to generate a stream";
        }
    }

    console.log('finished loading');
    return {streamPath: streamFile, subtitles, videoInfo};
}


function wait(ms) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, ms)
    })
}




module.exports = {getVideoInfo, getSubtitleTrackFromFile, startLoadingStream, convertFileToHTMLFriendly};



/*
Regarding different options to get all video types to the chrome engine:
    The current way actually is the most performant I've found- straight up transcode to a stream, write the stream out
    and suck it up with a transmuxer which feeds it to a normal html video element.

    I did consider decoding to raw and then sending raw video and audio
    but this command, at least, turned out to be not very fficient
        ffmpeg -ss 10:20 -re -i "c:/users/Daniel/Videos/demo.mkv" -f rawvideo -pix_fmt rgba -vcodec rawvideo raw.out

    And a gazillion other ways: jsmpeg with a custom source, 
    This works with jmuxer but the vdeo is too fast, probably because raw h264 doesnt carry timing info
		'-f', 'adts', '-movflags', 'frag_keyframe+empty_moov',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-vn',
        'udp://127.0.0.1:4001',

        '-f', 'h264', '-movflags', 'frag_keyframe+empty_moov',
        '-c:v', 'libx264', '-bsf', 'h264_mp4toannexb', '-preset', 'ultrafast', '-an',
        '-s', '720x540',  'udp://127.0.0.1:4000',
    

    I did consider decoding to raw and then sending raw video and audio
        but this command, at least, turned out to be not very fficient
        ffmpeg -ss 10:20 -re -i "c:/users/Daniel/Videos/demo.mkv" -f rawvideo -pix_fmt rgba -vcodec rawvideo raw.out

    Once I settled on an mpeg-2 stream I tried video.js frontend with a custom overlay providing forward-seek (which
    just restarted ffmpeg at a specific offset). It worked fine, except the first seek back to, say, the start of
    the current subtitle, after a cache-miss jump forward, was dodgy- I could not get it to seek to the correct time
    the first time. Every subsequent seek worked exactly fine...

    So I found the hls.js library, and it seeks properly and I can just link it to an HTML video element. I'm still using
    an overlay and hiding the video's controls to give the user the illusion that this is a static file but it's fine.
    It shouldn't take much effort to play supported videos and fall back if not. hls.js transmuxes the stream into 
    something that the html video element understands, I guess. There's plenty of room for fine-tuning if you 
    ever feel like it.

    For transport I've tried udp, ws and ipc. In the end plain old http hls seems the best- though I might want to 
    check out the DASH route instead once things have settled, see if that's any better performance-wise.
    
    */
