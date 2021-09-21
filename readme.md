# Animocha
A simple dual-subtitle video player inspired by [Animelon](http://animelon.com/). Theoretically cross-platform with some tweaks, but I do not own a mac.

### Features

- Dual subtitles with visibility toggles (and keyboard shortcuts `J` & `E` )
- `A` and `W` navigate by subtitle line
- Automatically pauses at the end of a subtitle line if mouse is over subtitles
- Concurrent subtitle lines (two characters talking at the same time, etc.)
- Resizeable panes
- Built-in, conjugation-aware dictionary (select text to automatically look it up)
- Change font sizes and whatnot
- Supports most codecs (including h.265 video)


![Screenshot](screenshot.png?raw=true)

### Installation

Go to the [Releases](https://github.com/mudbile/animocha/releases) page. The releases are listed with the newest release first. Click the Assets expando for the newest release. Since version v0.0.3, there should be a 7-zip archive and a standalone portable executable with everything packed inside (there will also be source file archives, which you can ignore). Either is fine. In my experience, the portable version is slower to start. If you go for the unpacked version, download the 7-zip archive, unzip and move the contents to *C:\Program Files* (or wherever).


### With Thanks To
- [FFmpeg](http://ffmpeg.org) developers
- [hls.js](https://github.com/video-dev/hls.js/): catches the stream output from FFmpeg.
- [Jim Breen](http://nihongo.monash.edu/japanese.html) (and current custodians [EDRG]("https://www.edrdg.org/")): For the JMDICT dictionaries!
- [Birchill, Inc](https://github.com/birchill): it is thanks to some beautiful code that I took from Rikaichamp that lets us search conjugations.
- [r/LearnJapanese](https://old.reddit.com/r/LearnJapanese/): I basically owe all my Japanese that didn't come stright from a book to the amazing people who volunteer  their time tirelessly for noobs like me in the ShitsuMonday threads: hadaa, lyrencropt, nanbanjin\_01, yamyukky, honkoku, dabedu, tamag0chi, ketchup901, teraflop, seestas, morgawr\_ . . . _the list is long!_

### Scavenging Code?

The most useful parts would probably be

- video-server.js, video.js and associated files, wherein I implemented the ability to transcode a video file live while also allowing the user to seek. You can look in video-server.js to see some of the other methods I _tried_ which in iteself could be educational.

### License

== GPL License

Copyright (C) 2021 eulerspill@protonmail.com

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see http://www.gnu.org/licenses/.
