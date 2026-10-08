const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
    const res = await axios.get('https://nerdytips.com/all-matches');
    const $ = cheerio.load(res.data);
    const groupKeys = [];
    $('[data-lg-k]').each((_, el) => {
        const k = $(el).attr('data-lg-k');
        if (k) groupKeys.push(k);
    });
    console.log("Groups:", groupKeys.length);
    if(groupKeys.length > 0) {
        const rowsUrl = `https://nerdytips.com/all-matches/rows?g=${encodeURIComponent(groupKeys.slice(0, 10).join(','))}`;
        const cRes = await axios.get(rowsUrl, { headers: {'X-Requested-With': 'XMLHttpRequest'} });
        if(cRes.data && cRes.data.groups) {
            const gk = Object.keys(cRes.data.groups)[0];
            const $g = cheerio.load(cRes.data.groups[gk]);
            const root = $g('a[href*="/match-details/"]').first();
            const time = root.find('.tb-mrow__date [data-time]').text().trim() || root.find('.tb-mrow__date').text().trim();
            const teamLines = root.find('.tb-teamline');
            const teamA = $g(teamLines[0]).find('.tb-tname').text().trim();
            const teamB = $g(teamLines[1]).find('.tb-tname').text().trim();
            console.log({ time, teamA, teamB });
        }
    }
}
run();
