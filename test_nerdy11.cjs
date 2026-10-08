const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('nerdy_get_d.html', 'utf8');
const $ = cheerio.load(html);
const rows = $('tr, .match-row, .score-board, .tb-match').toArray();
console.log('Matches found:', rows.length);

let extracted = 0;
for (const el of rows) {
    let teamA = "";
    let teamB = "";
    
    const teamNodes = $(el).find('.am-tl, .tb-teamline').toArray();
    if (teamNodes.length >= 2) {
        const t1 = $(teamNodes[0]).find('.tnm').length ? $(teamNodes[0]).find('.tnm').text() : $(teamNodes[0]).find('.am-tn, .tb-tname').text();
        const t2 = $(teamNodes[1]).find('.tnm').length ? $(teamNodes[1]).find('.tnm').text() : $(teamNodes[1]).find('.am-tn, .tb-tname').text();
        teamA = t1.trim();
        teamB = t2.trim();
    }
    
    let scoreResultText = "";
    const scoreH = $(el).find('[data-score-h]').first().text().trim();
    const scoreA = $(el).find('[data-score-a]').first().text().trim();
    
    if (scoreH !== "" && scoreA !== "") {
        scoreResultText = ` $scoreH:$scoreA`;
    }
    
    if (scoreResultText && teamA && teamB) {
        extracted++;
        console.log(teamA, 'vs', teamB, '->', scoreResultText);
    }
}
console.log('Successfully extracted:', extracted);
