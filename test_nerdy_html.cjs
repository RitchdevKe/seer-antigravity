const axios = require('axios');
const cheerio = require('cheerio');

async function testNerdy() {
    try {
        const dateStr = new Date().toISOString().split('T')[0];
        const res = await axios.get(`https://nerdytips.com/all-matches?d=${dateStr}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(res.data);
        const rows = $('tr[class*="match"], tr.match-row, .tb-match').toArray();
        if (rows.length > 0) {
            console.log($(rows[0]).html());
        }
    } catch(e) {
        console.error(e.message);
    }
}
testNerdy();
