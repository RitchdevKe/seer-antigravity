const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
    const res = await axios.get('https://nerdytips.com/match-details/new-england-ii-vs-huntsville-city-prediction-1298656');
    const $ = cheerio.load(res.data);
    $('.md-pcard, .md-best, .prediction-inline-wrap, [class*="prediction"], div.nt-panel').each((_, el) => {
        const label = $(el).find('.md-pcard__label, .md-best__label, h4, header, .prediction-title').text().trim();
        if(label.toLowerCase() === '1x2 tip') {
            console.log("HTML:", $(el).html());
        }
    });
}
run();
