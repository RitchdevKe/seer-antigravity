const axios = require('axios');
const cheerio = require('cheerio');

async function checkDate(date) {
  const url = `https://nerdytips.com/all-matches?d=${date}`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  const predicted = $('button').filter((i, el) => $(el).text().includes('Predicted')).first().text().trim();
  console.log(`d=${date} -> ${predicted}`);
}

async function run() {
  await checkDate('0');
  await checkDate('1');
}
run();
