const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
    const res = await axios.get('https://nerdytips.com/match-details/new-england-ii-vs-huntsville-city-prediction-1298656');
    const $ = cheerio.load(res.data);
    console.log("Details page:");
    console.log("tbm-pickscore:", $('.tbm-pickscore').text().trim());
    console.log("tb-mcell__pick:", $('.tb-mcell__pick').text().trim());
    console.log("tb-tip:", $('.tb-tip').text().trim());
    console.log("md-tip:", $('.md-tip').text().trim());
    console.log("md-tp__val:", $('.md-tp__val').text().trim());
}
run();
