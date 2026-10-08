const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function testNerdyDetails() {
    try {
        const detailsPage = await axios.get(`https://nerdytips.com/match-details/defensa-y-justicia-vs-platense-prediction-1298991`);
        const $ = cheerio.load(detailsPage.data);
        fs.writeFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\match_details.html', $('body').html());
        console.log("Written");
    } catch(e) {
        console.error(e.message);
    }
}
testNerdyDetails();
