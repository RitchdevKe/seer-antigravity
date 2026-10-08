const axios = require('axios');
const cheerio = require('cheerio');

async function checkDate(url) {
  try {
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 0 });
    const $ = cheerio.load(res.data);
    const cards = $('a[href*="/match-details/"]');
    console.log(`${url} - Total cards: ${cards.length}`);
  } catch (e) {
    console.log(`${url} - Failed: ${e.message}`);
  }
}

async function run() {
  await checkDate('https://nerdytips.com/all-matches?d=1&page=2');
  await checkDate('https://nerdytips.com/all-matches?d=1&p=2');
  await checkDate('https://nerdytips.com/all-matches/page/2?d=1');
}
run();
