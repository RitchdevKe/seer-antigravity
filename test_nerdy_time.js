const cheerio = require('cheerio');
const axios = require('axios');
async function run() {
    const res = await axios.get('https://nerdytips.com/all-matches');
    const $ = cheerio.load(res.data);
    const time = a[href*="/match-details/"].first().find('.tb-mrow__date [data-time]').text().trim() || a[href*="/match-details/"].first().find('.tb-mrow__date').text().trim();
    console.log("Time is:", time);
}
run();
