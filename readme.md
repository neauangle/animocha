# Animocha
A simple dual-subtitle video player inspired by [Animelon](http://animelon.com/). Theoretically cross-platform with some tiny tweaks, but I do not own a mac.

### Features

- Dual subtitles
- Built-in, conjugation-aware dictionary (simply select any text to look it up)
- Change font sizes and whatnot

![Screenshot](screenshot.png?raw=true)

### Notes
- Although Animocha supports pretty much all video formats through FFmpeg, this requires live transcoding. You will therefore suffer a significant performance hit. There is an inbuilt tool to convert videos to HTML-friendly video formats which work natively (that's what the "download" icon is).

- Animocha is currently very alpha. Please let me know if you like it or why you hate it or what you would like to see included in the future.

### With Thanks To
- [FFmpeg](http://ffmpeg.org) developers
- [hls.js](https://github.com/video-dev/hls.js/): catches the stream output from FFmpeg.
- [Jim Breen](http://nihongo.monash.edu/japanese.html) (and current custodians [EDRG]("https://www.edrdg.org/")): For the JMDICT dictionaries!
- [Birchill, Inc](https://github.com/birchill): it is thanks to some beautiful code that I took from Rikaichamp that lets us search conjugations.
- [r/LearnJapanese](https://old.reddit.com/r/LearnJapanese/): I basically owe all my Japanese that didn't come stright from a book to the amazing people who volunteer  their time tirelessly for noobs like me in the ShitsuMonday threads: hadaa, lyrencropt, nanbanjin\_01, yamyukky, honkoku, dabedu, tamag0chi, ketchup901, teraflop, seestas, morgawr\_ . . . _the list is long!_

### Scavenging Code?

The most useful parts would probably be

- video-server.js, video.js and associated files, wherein I implemented the ability to transcode a video file live while also allowing the user to seek. You can look in video-server.js to see some of the other methods I _tried_ which in iteself could be educational.
