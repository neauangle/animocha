const { Readable } = require("stream")
const csv = require('csv-parser')
const fs = require('fs')



let abbreviations = {};
compileNames();
compileVocabs();
compileKanjis();
abbreviations['work'] =  "work of art, literature, music, etc.";
abbreviations['work'] =  "work of art, literature, music, etc.";
for (const key of Object.keys(abbreviations)){
    abbreviations[key] = abbreviations[key]
        .replace('sonkeigo', '尊敬語 - そんけいご')
        .replace('kenjougo', '謙譲語 - けんじょうご')
        .replace('teineigo', '丁寧語 - ていねいご')
        .replace('keiyoushi', '形容詞 - けいようし')
        .replace('keiyodoshi', '形容動詞 - けいようどうし')
        .replace('rentaishi', '連体詞 - れんたいし')
        .replace('kandoushi', '感動詞 - かんどうし')
        .replace('fukushi', '副詞 - ふくし')
        .replace('jisoumeishi', '時相名詞 - じそうめいし')
        .replace('futsuumeishi', '普通名詞 - ふつうめいし')
        .replace('fukushitekimeishi', '時相名詞 - じそうめいし')
}

fs.writeFileSync("dict/abbreviations.json", JSON.stringify(abbreviations, null, " ")); 

function compileNames(){ 
    console.log('compiling names...')
    if (!fs.existsSync("./dict/")){
        fs.mkdirSync("dict");
    }
    console.log('    reading xml...')
    const names = [];
    let currentEntry;
    let currentTranslation;
    const xmlText = fs.readFileSync("JMnedict.xml").toString('utf-8');
    let lines = xmlText.split("\n");
    for (line of lines){
        if (line.startsWith("<!ENTITY ")){
            abbreviations[line.slice(9, line.indexOf(' ', 9+1))] = line.slice(line.indexOf('"')+1, line.indexOf('"', line.indexOf('"')+1));
        } else if (line.startsWith("<entry>")){
            currentEntry = [null, null, null];
        } else if (line.startsWith("<keb>")){
            if (!currentEntry[0]){
                currentEntry[0] = [];
            }
            currentEntry[0].push(line.slice(5, line.indexOf("</keb>")));
        } else if (line.startsWith("<reb>")){
            if (!currentEntry[1]){
                currentEntry[1] = [];
            }
            currentEntry[1].push(line.slice(5, line.indexOf("</reb>")));
        


        } else if (line.startsWith("<trans>")){
            currentTranslation = [null, null];
        } else if (line.startsWith("<name_type>")){
            if (!currentTranslation[1]){
                currentTranslation[1] = [];
            }
            currentTranslation[1].push(line.slice(11+1, line.indexOf("</name_type>")-1));//because it's original "&type;"
        } else if (line.startsWith("<trans_det>")){
            if (!currentTranslation[0]){
                const indexOfOriginal = line.indexOf('>')+1;
                const endIndexOfOriginal = line.indexOf('</trans_det>');
                if (endIndexOfOriginal > indexOfOriginal){
                    currentTranslation[0] =  line.slice(indexOfOriginal, endIndexOfOriginal);
                }
            }
        } else if (line.startsWith("</trans>")){
            if (!currentEntry[2]){
                currentEntry[2] = [];
            }
            currentEntry[2].push(currentTranslation);
            currentTranslation = null;

        
        } else if (line.startsWith("</entry>")){
            names.push(currentEntry);
            currentEntry = null;
        }
    }
    fs.writeFileSync("dict/names.json", JSON.stringify(names));


    console.log('    compiling readings to infos...')
    const readingToInfo = {};
    for (let i = 0; i < names.length; ++i){
        const entry = names[i];
        for (let array of [entry[0], entry[1]]){
            if (array){
                for (let reading of array){
                    if(!readingToInfo[reading]){
                        readingToInfo[reading] = [];
                    }

                    for (translationInfo of entry[2]){
                        let exists = false;

                        for (const existingEntry of readingToInfo[reading]){
                            if (translationInfo[0] === existingEntry[0]){
                                for (let type of translationInfo[1].filter(t => !existingEntry[1].includes(t))){
                                    existingEntry[1].push(type);
                                }
                                exists = true;
                                break;
                            }
                        }
                        if (!exists){
                            const info = [translationInfo[0], translationInfo[1] || []];
                            readingToInfo[reading].push(info);
                        }
                    }
                }
            }
        }
    }

    fs.writeFileSync("dict/name-reading-to-info.json", JSON.stringify(readingToInfo));
    
    console.log('    compiling info map...')
    const readingInfos = [];
    const readingToInfoIndex = {};
    const infoStringToReading = {};
    for (const reading of Object.keys(readingToInfo)){
        const infoString = JSON.stringify(readingToInfo[reading]);
        if (!infoStringToReading[infoString]){
            infoStringToReading[infoString] = [];
        }
        infoStringToReading[infoString].push(reading);
    }

    let index = 0;
    for (const infoString of Object.keys(infoStringToReading)){
        readingInfos.push(JSON.parse(infoString));
        for (const reading of infoStringToReading[infoString]){
            readingToInfoIndex[reading] = index;
        }
        index += 1;
    }

    fs.writeFileSync("dict/name-reading-infos.json", JSON.stringify(readingInfos));
    fs.writeFileSync("dict/name-reading-to-info-index.json", JSON.stringify(readingToInfoIndex));
    

    
    console.log('    compiling reading to indexes...')
    const readingToIndex = {};
    for (let i = 0; i < names.length; ++i){
        const entry = names[i];
        for (let array of [entry[0], entry[1]]){
            if (array){
                for (let reading of array){
                    if(!readingToIndex[reading]){
                        readingToIndex[reading] = [];
                    }
                    readingToIndex[reading].push(i);
                }
            }
        }
    }
    fs.writeFileSync("dict/name-reading-to-indexes.json", JSON.stringify(readingToIndex));
    console.log('    names completed!')
}












function compileVocabs(){
    console.log('compiling vocabs....')
    if (!fs.existsSync("./dict/")){
        fs.mkdirSync("dict");
    }
    console.log('    reading xml...')
    const vocab = [];
    let currentEntry;
    let currentSense;
    let currentKanaReading;
    const xmlText = fs.readFileSync("JMdict_e").toString('utf-8');
    let lines = xmlText.split("\n");
    for (line of lines){
        if (line.startsWith("<!ENTITY ")){
            abbreviations[line.slice(9, line.indexOf(' ', 9+1))] = line.slice(line.indexOf('"')+1, line.indexOf('"', line.indexOf('"')+1));
        } else if (line.startsWith("<entry>")){
            currentEntry = {};
        } else if (line.startsWith("<keb>")){
            if (!currentEntry.kanjiReadings){
                currentEntry.kanjiReadings = [];
            }
            currentEntry.kanjiReadings.push(line.slice(5, line.indexOf("</keb>")));
        
        } else if (line.startsWith('<r_ele>')){
            currentKanaReading = {}
        } else if (line.startsWith("<reb>")){
            currentKanaReading.k = line.slice(5, line.indexOf("</reb>"));
        } else if (line.startsWith("<re_restr>")){
            if (! currentKanaReading.restrictedToKebs){
                currentKanaReading.restrictedToKebs = [];
            }
            currentKanaReading.restrictedToKebs.push(line.slice(10, line.indexOf("</re_restr>")));
        } else if (line.startsWith('</r_ele>')){
            if (!currentEntry.kanaReadings){
                currentEntry.kanaReadings = [];
            }
            currentEntry.kanaReadings.push(currentKanaReading);
            currentKanaReading = null


        } else if (line.startsWith("<sense>")){
            currentSense = {};
        } else if (line.startsWith("<pos>")){
            if (!currentSense.partsOfSentence){
                currentSense.partsOfSentence = [];
            }
            const pos = line.slice(5+1, line.indexOf("</pos>")-1);//because it's original "&pos;"
            currentSense.partsOfSentence.push(pos);
        } else if (line.startsWith("<stagk>")){
            if (!currentSense.onlyForReadings){
                currentSense.onlyForReadings = [];
            }
            currentSense.onlyForReadings.push(line.slice(7, line.indexOf("</stagk>")));
        } else if (line.startsWith("<dial>")){
            currentSense.dialect = line.slice(6, line.indexOf("</dial>"));
        } else if (line.startsWith("<stagr>")){
            if (!currentSense.onlyForReadings){
                currentSense.onlyForReadings = [];
            }
            currentSense.onlyForReadings.push(line.slice(7, line.indexOf("</stagr>")));
        } else if (line.startsWith("<gloss")){
            if (!currentSense.glosses){
                currentSense.glosses = [];
            }
            currentSense.glosses.push(line.slice(line.indexOf(">")+1, line.indexOf("</gloss>")));
        } else if (line.startsWith("<misc>")){
            if (!currentSense.miscs){
                currentSense.miscs = [];
            }
            currentSense.miscs.push(line.slice(6+1, line.indexOf("</misc>")-1));//because it's original "&misc;"
        } else if (line.startsWith("<s_inf>")){
            if (!currentSense.senseInfos){
                currentSense.senseInfos = [];
            }
            currentSense.senseInfos.push(line.slice(7, line.indexOf("</s_inf>")));
        } else if (line.startsWith("<field>")){
            if (!currentSense.fields){
                currentSense.fields = [];
            }
            currentSense.fields.push(line.slice(7, line.indexOf("</field>")));
        } else if (line.startsWith("<lsource>")){
            if (!currentSense.lsources){
                currentSense.lsources = [];
            }
            const lSource = {};
            const indexOfLang = line.indexOf('xml:lang="');
            if (indexOfLang >= 0){
                lSource.language = line.slice(indexOfLang+9, line.indexOf('"', indexOfLang+9));
            }
            const indexOfOriginal = line.indexOf('>')+1;
            const endIndexOfOriginal = line.indexOf('</lsource>');
            if (endIndexOfOriginal > indexOfOriginal){
                lsource.original =  line.slice(indexOfOriginal, endIndexOfOriginal);
            }
            currentSense.lsources.push(lSource);

        } else if (line.startsWith("</sense>")){
            if (!currentEntry.senses){
                currentEntry.senses = [];
            }
            currentEntry.senses.push(currentSense);
            currentSense = null;

        
        } else if (line.startsWith("</entry>")){
            vocab.push(currentEntry);
            currentEntry = null;
        }
    }

    fs.writeFileSync("dict/vocabs.json", JSON.stringify(vocab)); 
    

    console.log('    compiling reading to indexes...')
    const readingToIndex = {};
    for (let i = 0; i < vocab.length; ++i){
        const entry = vocab[i];
        if (entry.kanaReadings){
            for (let reading of entry.kanaReadings){
                if(!readingToIndex[reading.k]){
                    readingToIndex[reading.k] = [];
                }
                readingToIndex[reading.k].push(i);
            }
        }
        if (entry.kanjiReadings){
            for (let reading of entry.kanjiReadings){
                if(!readingToIndex[reading]){
                    readingToIndex[reading] = [];
                }
                readingToIndex[reading].push(i);
            }
        }
    }
    fs.writeFileSync("dict/vocab-reading-to-indexes.json", JSON.stringify(readingToIndex));
    console.log('    vocab completed!')
}

 

function compileKanjis(){
    console.log('compiling kanjis...')
    const kanji = {};
    let currentKanji;
    const xmlText = fs.readFileSync("kanjidic2.xml").toString('utf-8');
    const lines = xmlText.split("\n");
    for (line of lines){
        if (line.startsWith("<literal>")){
            currentKanji = line.slice(9, line.indexOf("</literal>"));
            kanji[currentKanji] = []
        } else if (line.startsWith("<meaning>")){
            kanji[currentKanji].push(line.slice(9, line.indexOf("</meaning>")));
        }
    }
    fs.writeFileSync("dict/kanjis.json", JSON.stringify(kanji));
    console.log('    kanjis completed!')
}


