import {deinflect, WordType, deinflectionKeys} from './deinflect.js';

let vocabs;
let vocabReadingsToIndexes;
let nameInfos;
let nameReadingToInfoIndex;
let abbreviations;
let kanjis;
let inited = false;

export async function init(callback){
    await fetch("./js/dict/vocabs.json").then(response => response.json()).then(json => {vocabs = json;});
    callback && callback(0.25);
    await fetch("./js/dict/vocab-reading-to-indexes.json").then(response => response.json()).then(json => {vocabReadingsToIndexes = json});
    callback && callback(0.5);
    await fetch("./js/dict/name-reading-infos.json").then(response => response.json()).then(json => {nameInfos = json});
    callback && callback(0.75);
    await fetch("./js/dict/name-reading-to-info-index.json").then(response => response.json()).then(json => {nameReadingToInfoIndex = json});
    callback && callback(1.00);
    await fetch("./js/dict/kanjis.json").then(response => response.json()).then(json => {kanjis = json});
    await fetch("./js/dict/abbreviations.json").then(response => response.json()).then(json => {abbreviations = json});
    console.log('dictionary initialised');
    inited = true
}

export function getHTMLStringFromSearchResult(searchResult){
    if (!searchResult.searchTerm){
        return "";
    }
    let html = "";
    if (searchResult.vocabs.length){
        let entriesHTML = '';
        for (const vocabResult of searchResult.vocabs){
            const inflectionString = vocabResult[1] ? vocabResult[1].split(' <').join('&nbsp;<') : "";
            for (const matchEntry of vocabResult[2]){
                let sensesHTML = '';
                for (const sense of matchEntry.senses){
                    console.log(sense);
                    let headerString = '';
                    let tooltipString = ''
                    const headerElements = (sense.partsOfSentence || []).concat(sense.miscs || [])
                    if (headerElements.length){
                        headerString = '(' + headerElements.join(', ') + ')';
                        tooltipString = `title="${headerElements.map(k=>'- '+(abbreviations[k] || k)).join('\n')}"`;
                    }
                    sensesHTML += `
                        <div>
                            <div class='search-result-vocab-entry-sense-header' ${tooltipString}>${headerString}</div>
                            <div class='search-result-vocab-entry-sense-glosses'>${sense.glosses?sense.glosses.join(', '):""}</div>
                        </div>
                    `;
                }
                let headerHTML = ``
                let mainString = '';
                let kanaString = '';
                if (matchEntry.kanjiReadings && matchEntry.kanjiReadings.length){
                    mainString = matchEntry.kanjiReadings[0];
                    if (matchEntry.kanaReadings && matchEntry.kanaReadings.length){
                        kanaString = matchEntry.kanaReadings[0].k;
                    }
                } else {
                    if (matchEntry.kanaReadings && matchEntry.kanaReadings.length){
                        mainString = matchEntry.kanaReadings[0].k;
                    }
                }
                
                
                entriesHTML += `
                    <div class='search-result-vocab-entry'>
                        <div class='search-result-vocab-entry-header'>
                            <div class='search-result-vocab-entry-header-word'>${mainString}</div>
                            <div class='search-result-vocab-entry-header-kana'>${kanaString}</div>
                        </div>
                        <div class='search-result-vocab-entry-inflection'>${inflectionString}</div>
                        <div class='search-result-vocab-entry-senses'>
                            ${sensesHTML}
                        </div>   
                    </div>
                `;
            }
        }
            

        html += `
            <div>
                <div class='search-result-section-title'>Vocab</div>
                <div class='search-result-vocab-entries'>
                    ${entriesHTML}
                </div>
            </div>
        `;
    }

    if (searchResult.names.length){
        let entriesHTML = '';
        for (const entry of searchResult.names){
            let typeString = '';
            if (entry[1] && entry[1].length){
                typeString = ` (` + entry[1].join('・') + `)`
            }
            entriesHTML += `
                <div class='search-result-name-entry'>
                    <div class='search-result-name-entry-name'>
                        ${entry[0]}
                    </div>
                    <div class='search-result-name-entry-types'>
                        ${typeString}
                    </div>
                </div>
            `; 
        }
        html += `
            <div>
                <div class='search-result-section-title'>Names</div>
                <div class='search-result-name-entries'>
                    ${entriesHTML}
                </div>
            </div>
        `;
    }

    if (searchResult.kanjis.length){
        let entriesHTML = '';
        for (const entry of searchResult.kanjis){
            let meaningsString = entry[1].join('・');
            entriesHTML += `
                <div class='search-result-kanji-entry'>
                    <div class='search-result-kanji-entry-kanji'>
                        ${entry[0]}:
                    </div>
                    <div class='search-result-kanji-entry-meanings'>
                        ${meaningsString}
                    </div>
                </div>
            `;
        }
        
        html += `
            <div>
                <div class='search-result-section-title'>Kanji</div>
                <div class='search-result-kanji-entries'>
                    ${entriesHTML}
                </div>
            </div>
        `;
    }

    if (!html){
        html = `
            <div class='search-result'>
                <div class='search-term'>&quot;${searchResult.searchTerm}&quot;</div>
                <div class='search-result-empty'>No results...</div>
            </div>
        `;
    } else {
        let searchTermHTML = `
            ${searchResult.matchedPart}<span class='search-term-unmatched'>${searchResult.searchTerm.slice(searchResult.matchedPart.length)}</span>
        `;
        const parts =
        html = `
            <div class='search-result'>
                <div class='search-term'>&quot;${searchTermHTML}&quot;</div>
                <div class='search-results'>${html}</div>
            </div>
        `;
    }

    return html;
}


export function searchWord(japanese){
    japanese = japanese.trim();
    const results = {names: [], vocabs: [], kanjis: [], searchTerm: japanese, matchedPart: japanese};
    if (!inited || !japanese){ 
        return results;
    }

    if (nameReadingToInfoIndex[japanese]){
        results.names = nameInfos[nameReadingToInfoIndex[japanese]];
    }

    for (const c of japanese){
        if (kanjis[c]){
            results.kanjis.push([c, kanjis[c]]);
        }
    }

    while(japanese.length){
        const candidates = deinflect(japanese);
        for (const [candidateIndex, candidate] of candidates.entries()) {
            let indexes = vocabReadingsToIndexes[candidate.word];
            if (!indexes){
                continue;
            }
            
            
            let sortedMatchesA = [];
            let sortedMatchesB = [];
            let matchingKanaReading;
            let allReadings = [];
            for (let index of indexes){
                const vocabEntry = {...vocabs[index]};//shallow copy
                if (vocabEntry.kanaReadings){
                    for (let kanaReading of vocabEntry.kanaReadings){
                        allReadings.push(kanaReading.k);
                        if (kanaReading.k === candidate.word){
                            matchingKanaReading = kanaReading;
                            if (kanaReading.restrictedToKebs){
                                vocabEntry.kanjiReadings = vocabEntry.kanjiReadings.filter(k => kanaReading.restrictedToKebs.includes(k));
                                if (!vocabEntry.kanjiReadings.length){
                                    delete vocabEntry.kanjiReadings;
                                }
                            }
                        }
                    }
                }
                if (vocabEntry.kanjiReadings){
                    allReadings = allReadings.concat(vocabEntry.kanjiReadings);
                }
                if (matchingKanaReading){
                    if (vocabEntry.kanaReadings[0] !== matchingKanaReading){
                        vocabEntry.kanaReadings = [matchingKanaReading].concat(vocabEntry.kanaReadings.filter(k=>k !== matchingKanaReading));
                    }
                } else {
                    if (vocabEntry.kanjiReadings[0] !== candidate.word){
                        vocabEntry.kanjiReadings = [candidate.word].concat(vocabEntry.kanjiReadings.filter(k=>k !== candidate.word));
                    }
                }

                let restrictedSenses = [];
                for (const sense of vocabEntry.senses){
                    if (!sense.onlyForReadings || sense.onlyForReadings.filter(k=>allReadings.includes(k)).length){
                        restrictedSenses.push(sense);
                    }
                }
                vocabEntry.senses = restrictedSenses;

                if (matchingKanaReading && !vocabEntry.kanjiReadings){
                    sortedMatchesA.push(vocabEntry);
                } else {
                    sortedMatchesB.push(vocabEntry);
                }     
                
            }


            let matches = sortedMatchesA.concat(sortedMatchesB);
            matches = matches.filter((match) =>candidateIndex === 0 || entryMatchesType(match, candidate.type));
            if (!matches.length) {
                continue;
            }
            
            let inflectionString;
            if (candidate.reasons.length) {
                inflectionString = '< ' + candidate.reasons.map((reasonList) => reasonList.map((reason) => deinflectionKeys[reason]).join(' < '));
            }
            results.vocabs.push([candidate.word, inflectionString, matches]);
        }
        //this means if we have a matching name, we give up after checking vocab for full word
        if (results.vocabs.length){
            break;
        } else if (results.names.length){
            break;
        } else {
            japanese = japanese.slice(0, -1);
            results.matchedPart = japanese;
        }
    }

    
    return results;
}





// Tests if a given entry matches the type of a generated deflection
//grabbed from https://github.com/birchill/10ten-ja-reader by Brian Birtles (see deinflect.js)
function entryMatchesType(entry, type) {
    const hasMatchingSense = test => entry.senses.some((sense) => sense.partsOfSentence?.some(test));

    if (
      type & WordType.IchidanVerb &&
      hasMatchingSense((pos) => pos.startsWith('v1'))
    ) {
      return true;
    }
  
    if (
      type & WordType.GodanVerb &&
      hasMatchingSense((pos) => pos.startsWith('v5') || pos.startsWith('v4'))
    ) {
      return true;
    }
  
    if (
      type & WordType.IAdj &&
      hasMatchingSense((pos) => pos.startsWith('adj-i'))
    ) {
      return true;
    }
  
    if (type & WordType.KuruVerb && hasMatchingSense((pos) => pos === 'vk')) {
      return true;
    }
  
    if (
      type & WordType.SuruVerb &&
      hasMatchingSense((pos) => pos.startsWith('vs-'))
    ) {
      return true;
    }
  
    if (type & WordType.NounVS && hasMatchingSense((pos) => pos === 'vs')) {
      return true;
    }
  
    return false;
  }




