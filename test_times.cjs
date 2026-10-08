const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://nerdytips.com/all-matches').then(r => {
    const $ = cheerio.load(r.data);
    const times = $('a[href*="/match-details/"]').slice(0, 5).map((i, el) => {
        return $(el).find('.tb-mrow__date [data-time]').text().trim() || $(el).find('.tb-mrow__date').text().trim();
    }).get();
    console.log(times);
});
