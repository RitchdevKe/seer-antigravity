const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    console.log("Fetching NerdyTips for today...");
    const matchesPage = await axios.post('https://nerdytips.com/all-matches/get-matches', new URLSearchParams({
        date: 'today',
        type: 'all',
        page: '1',
        country: '',
        all_remaining: '0'
    }).toString(), {
        headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
        }
    });

    const $ = cheerio.load(matchesPage.data);
    const rows = $('tr[class*="match"], tr.match-row').toArray();
    
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        const el = rows[i];
        const time = $(el).find('.score-time, .time, .score-date').text().trim();
        const teamA = $(el).find('.home-team-name, .home-team, .score-left span, [class*="home-team"]').first().text().trim();
        const teamB = $(el).find('.away-team-name, .away-team, .score-right span, [class*="away-team"]').first().text().trim();
        console.log(`${time} | ${teamA} vs ${teamB}`);
    }
}
test().catch(console.error);
