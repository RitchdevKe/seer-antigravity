const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
    const res = await axios.get('https://nerdytips.com/match-details/new-england-ii-vs-huntsville-city-prediction-1298656');
    const $ = cheerio.load(res.data);
    let found = false;
    $('script').each((_, el) => {
        const scriptText = $(el).html();
        if(scriptText && (scriptText.includes('1x2') || scriptText.includes('prediction'))) {
            console.log("Found script tag:");
            console.log(scriptText.substring(0, 500));
            found = true;
        }
    });
}
run();
