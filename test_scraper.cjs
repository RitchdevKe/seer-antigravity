const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
    const res = await axios.get('https://nerdytips.com/all-matches');
    const $ = cheerio.load(res.data);
    const rows = $('a[href*="/match-details/"]').slice(0, 5).toArray();
    for (const el of rows) {
        const root = $(el);
        const time = root.find('.tb-mrow__date [data-time]').text().trim() || root.find('.tb-mrow__date').text().trim();
        const teamLines = root.find('.tb-teamline');
        const teamA = $(teamLines[0]).find('.tb-tname').text().trim();
        const teamB = $(teamLines[1]).find('.tb-tname').text().trim();
        console.log({ time, teamA, teamB });
    }
}
run();
