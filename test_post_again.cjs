const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
  try {
    const res = await axios.post('https://nerdytips.com/all-matches/get-matches', new URLSearchParams({
        date: '-1',
        type: 'all',
        page: '1',
        country: '',
        all_remaining: '0'
    }).toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
        }
    });
    const $ = cheerio.load(res.data);
    const m = $('.tb-match').toArray();
    console.log("POST /get-matches .tb-match count:", m.length);
  } catch (err) { console.error("POST failed:", err.message); }
}
run();
