const axios = require('axios');
const cheerio = require('cheerio');

async function testNerdy() {
    try {
        const dateStr = new Date().toISOString().split('T')[0];
        console.log("Fetching for:", dateStr);
        const res = await axios.get(`https://nerdytips.com/all-matches?d=${dateStr}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(res.data);
        const rows = $('tr[class*="match"], tr.match-row, .tb-match').toArray();
        console.log(`Found ${rows.length} rows`);
        
        let valid = 0;
        let skippedTime = 0;
        let skippedTeams = 0;
        
        for (let i=0; i<rows.length; i++) {
            const el = rows[i];
            const time = $(el).find('.score-time, .time, .score-date, .am-mt, [data-time], .num.tb-stwrap').text().trim();
            
            let teamA = "";
            let teamB = "";
            const teamNodes = $(el).find('.am-tl, .tb-teamline').toArray();
            if (teamNodes.length >= 2) {
               const t1 = $(teamNodes[0]).find('.tnm').length ? $(teamNodes[0]).find('.tnm').text() : $(teamNodes[0]).find('.am-tn, .tb-tname').text();
               const t2 = $(teamNodes[1]).find('.tnm').length ? $(teamNodes[1]).find('.tnm').text() : $(teamNodes[1]).find('.am-tn, .tb-tname').text();
               teamA = t1.trim();
               teamB = t2.trim();
            }
            if (!teamA) teamA = $(el).find('.home-team-name, .home-team, .score-left span, [class*="home-team"]').first().text().trim();
            if (!teamB) teamB = $(el).find('.away-team-name, .away-team, .score-right span, [class*="away-team"]').first().text().trim();
            
            if (!teamA || !teamB) {
                skippedTeams++;
                continue;
            }
            if (!time) {
                skippedTime++;
            }
            valid++;
        }
        
        console.log(`Valid matches: ${valid}`);
        console.log(`Skipped due to missing teams: ${skippedTeams}`);
        console.log(`Valid matches missing time: ${skippedTime}`);
        
    } catch(e) {
        console.error(e.message);
    }
}
testNerdy();
