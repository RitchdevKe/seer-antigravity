const cheerio = require('cheerio');
const axios = require('axios');
async function run() {
    const res = await axios.get('https://nerdytips.com/all-matches');
    const $ = cheerio.load(res.data);
    const times = [];
    a[href*="/match-details/"].slice(0, 5).each((i, el) => {
        const t = .find('.tb-mrow__date [data-time]').text().trim() || .find('.tb-mrow__date').text().trim();
        times.push(t);
    });
    console.log("Times:", times);
}
run();
