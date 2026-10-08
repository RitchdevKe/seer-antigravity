const axios = require('axios');
const cheerio = require('cheerio');

async function checkDate(date) {
  const url = `https://nerdytips.com/all-matches?d=${date}`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  const cards = $('a[href*="/match-details/"]');
  console.log(`${date} - Total cards: ${cards.length}`);
}

async function run() {
  await checkDate('2026-08-26');
  await checkDate('2026-08-27');
  await checkDate('2026-08-28');
}
run();
