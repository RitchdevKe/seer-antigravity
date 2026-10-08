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
    if(groupKeys.length > 0) {
        const rowsUrl = `https://nerdytips.com/all-matches/rows?g=${encodeURIComponent(groupKeys.slice(0, 1).join(','))}`;
        const cRes = await axios.get(rowsUrl, { headers: {'X-Requested-With': 'XMLHttpRequest'} });
        if(cRes.data && cRes.data.groups) {
            const gk = Object.keys(cRes.data.groups)[0];
            const $g = cheerio.load(cRes.data.groups[gk]);
            const root = $g('a[href*="/match-details/"]').first();
            console.log(root.html());
        }
    }
}
run();
