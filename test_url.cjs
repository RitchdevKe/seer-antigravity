const axios = require('axios');
const cheerio = require('cheerio');

async function checkDate(url) {
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  const cards = $('a[href*="/match-details/"]');
  console.log(`${url} - Total cards: ${cards.length}`);
  if (cards.length > 0) {
      console.log("First card:", $(cards[0]).attr('href'));
  }
}

async function run() {
  await checkDate('https://nerdytips.com/all-matches');
  await checkDate('https://nerdytips.com/all-matches/2026-08-26');
  await checkDate('https://nerdytips.com/all-matches?date=2026-08-27');
  await checkDate('https://nerdytips.com/all-matches?d=2026-08-27');
  await checkDate('https://nerdytips.com/all-matches/2026-08-27');
}
run();
