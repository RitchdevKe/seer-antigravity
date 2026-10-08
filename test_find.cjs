const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
  let allText = "";
  for (let d of [-2, -1, 0, 1]) {
    const res = await axios.get(`https://nerdytips.com/all-matches?d=${d}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    $('.tb-match, .am-mrow, tr').each((i, el) => {
        const t = $(el).text().replace(/\s+/g, ' ');
        if (t.toLowerCase().includes('leon') || t.toLowerCase().includes('santa fe')) {
            console.log(`Date d=${d}:`, t);
        }
    });
  }
}
run();
