export function getSeasrchResultCard(id, title, article){
    const template = `
        <div class="tile card">
            <button class="card-header-button"><h4 class="lang-ja card-title">{{title}}</h4></button>
            <hr/>
            <div class="card-article">
                {{article}}
            </div>
            <hr/>
            <footer class="is-right card-footer">
                <button class="button add-ancestor" >+</button>
            </footer>
        </div>
    `   
    //this method seems to handle html quoting automatically
    const htmlString = template.replace('{{title}}', title).replace('{{article}}', article);
    var dummyParent = document.createElement('div');
    dummyParent.innerHTML = htmlString;
    return dummyParent.firstElementChild;
}



export function getTitlePart(text){
    const template = `
        <div class="current-card-title-part">
            <div class="current-card-title-part-text lang-ja">
                {{text}}
            </div>
            <!--<div class="current-card-title-part-button-container">
                <button class="current-card-title-part-add-button">+</button>
            </div>-->
        </div>
    `;
    //this method seems to handle html quoting automatically
    const htmlString = template.replace('{{text}}', text);
    var dummyParent = document.createElement('div');
    dummyParent.innerHTML = htmlString;
    return dummyParent.firstElementChild;
}

export function getTag(tagText){
    let tag = document.createElement('div');
    tag.classList.add('tag');
    tag.innerText = tagText;
    return tag;
}

export function getSubttitleRow(text){
    const template = `
    <div class="subtitle-row">
        <img class="svg-icon subtitle-play-button" src="img/icons/material-design/play-circle-outline.svg"/>
        <div class="subtitle-text">{{text}}</div>
    </div>`
    const htmlString = template.replace('{{text}}', text);
    var dummyParent = document.createElement('div');
    dummyParent.innerHTML = htmlString;
    return dummyParent.firstElementChild;
}