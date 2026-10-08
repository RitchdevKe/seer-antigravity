const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    const today = new Date().toISOString().split('T')[0];
    const resp = await axios.post('https://nerdytips.com/all-matches/get-matches', new URLSearchParams({
        date: today, type: 'all', page: '1', country: '', all_remaining: '0'
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' } });
    const $ = cheerio.load(resp.data);
    $('tr.match-row').each((_, el) => {
        const teamA = $(el).find('.home-team-name').text().trim();
        const teamB = $(el).find('.away-team-name').text().trim();
        const pred = $(el).find('.td-tip p, .prediction-1x2').text().trim().replace(/\s+/g, ' ');
        if (teamA) { console.log(`${teamA} vs ${teamB} : ${pred}`); }
    });
}
test();
