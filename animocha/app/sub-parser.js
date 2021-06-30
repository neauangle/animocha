
////[{startTimeSeconds, endTimeSeconds, dialogue, a, an, index}, ...]
function fromASS(ass, newline){
    const set = [];

    const lines = ass.split('\n');
    let playResX; //unused - we don't support marginL, etc. overriding 
    let playResY; //unused - we don't support marginL, etc. overriding
    let nextLineIsEventHeader = false;
    let headerToIndex = {}
    
    for (let line of lines){
        if (line.startsWith('Dialogue:')){
            const fields = line.slice(line.indexOf(':') + 1).split(',');
            const entry = {startTimeSeconds:null, endTimeSeconds: null, a: null, an: null, dialogue:null}
            
            let parts = fields[headerToIndex['Start']].split(':');
            entry.startTimeSeconds = Number(parts[0]) * 60*60 + Number(parts[1])*60 + Number(parts[2]);
            if (parts.length > 3){
                entry.startTimeSeconds += Number(parts[3]) * 0.01;
            }
            parts = fields[headerToIndex['End']].split(':');
            entry.endTimeSeconds = Number(parts[0]) * 60*60 + Number(parts[1])*60 + Number(parts[2]);
            if (parts.length > 3){
                entry.endTimeSeconds += Number(parts[3]) * 0.01;
            }
            
            let dialogue = fields[headerToIndex['Text']];
            for (let i = headerToIndex['Text']+1; i < fields.length; ++i){
                dialogue += ',' + fields[i];
            }

            let cleanedDialogue = "";
            const positionInfoIndex = dialogue.indexOf('\\pos(');
            if (positionInfoIndex >= 0){
                entry.an = '8'; //keeping it simple
            }

            let debuggingDialogue = false;

            const numbers = ['1','2','3','4','5','6','7','8','9','0'];
            let i = 0;
            while (i < dialogue.length){
                if (debuggingDialogue){
                    console.log(i,dialogue.slice(i));
                }

                if (dialogue.startsWith('{\\an', i) && numbers.includes(dialogue[i+4])){
                    entry.an = dialogue[i+4];
                    i += 6
                } else if(dialogue.startsWith('{\\a', i) && numbers.includes(dialogue[i+3])){
                    if (dialogue.startsWith('10', i+3)){
                        entry.a = '10';
                        i += 6;
                    } else {
                        entry.a = dialogue[i+3];
                        i += 5;
                    }
                } else if (dialogue.startsWith('{\\', i) || dialogue.startsWith('{(\\', i)){
                    debuggingDialogue && console.log(`found {\\ at ${i}, moving to: ${dialogue.slice(dialogue.indexOf('}', i) + 1)}`);
                    i = dialogue.indexOf('}', i) + 1;
                } else if (dialogue.startsWith('\\N', i)){
                    debuggingDialogue && console.log(`found \\N at ${i}, moving to i+2: ${dialogue.slice(i+2)}`);
                    cleanedDialogue += newline;
                    i += 2;
                } else {
                    cleanedDialogue += dialogue[i];
                    i += 1;
                }
            }
            cleanedDialogue = cleanedDialogue.trim()
            if (cleanedDialogue.length > 0){
                entry.dialogue = cleanedDialogue;
                entry.index = set.length;
                set.push(entry);
            }
           

        } else  if (line.startsWith('[Events]')){
            nextLineIsEventHeader = true
        } else if (nextLineIsEventHeader){
            nextLineIsEventHeader = false;
            const headers = line.slice(line.indexOf(':') + 1).split(',');
            for (let i = 0; i < headers.length; ++i){
                headerToIndex[headers[i].trim()] = i;
            }
            console.log('header', headerToIndex);
        } else  if (line.startsWith('PlayResX:')){
            playResX = Number(line.slice(9));
        } else  if (line.includes('PlayResY:')){
            playResY = Number(line.slice(9));
        }
       
    }

    return set;
}

/* 
////[{startTimeSeconds, endTimeSeconds, dialogue}, ...]
//todo: deal with positioning tags (\{anX} and \{anX})
function fromSRT(srt, newlineInDialogue){
    let set = []
    let chunks = srt.split('\n\n');
    let lastEnd = -1;
    for (let chunk of chunks){
        const lines = chunk.split('\n');
        if (lines.length === 1 && !lines[0]){
            continue;
        }
        let dialogue = lines[2].trim();
        for (let i = 3; i < lines.length; ++i){
            dialogue += newlineInDialogue + lines[i].trim();
        }
        const timing = lines[1]
        const timingSecs = [];
        for (let time of timing.split('-->')){
            const parts = time.split(':');
            parts[2] = parts[2].replace(',', '.');
            timingSecs.push(Number(parts[0])*60*60 + Number(parts[1])*60 + Number(parts[2]));
        }
        if (lastEnd > timingSecs[0]){
            timingSecs[0] = lastEnd;
        }
        set.push({startTimeSeconds: timingSecs[0], endTimeSeconds: timingSecs[1], dialogue});
    }
    return set;
}
 */

module.exports = {fromASS};
