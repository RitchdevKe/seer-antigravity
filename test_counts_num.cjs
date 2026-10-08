const axios = require('axios');
const cheerio = require('cheerio');

async function checkDate(date) {
  const url = `https://nerdytips.com/all-matches?d=${date}`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  const cards = $('a[href*="/match-details/"]');
  console.log(`${date} - Total cards: ${cards.length}`);
  if (cards.length > 0) {
      console.log("First card:", $(cards[0]).attr('href'));
  }
}

async function run() {
  await checkDate('0');
  await checkDate('1');
  await checkDate('2');
  await checkDate('-1');
  await checkDate('-2');
}
run();
