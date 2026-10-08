const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
  const url = `https://nerdytips.com/all-matches?d=0`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  const matchNodes = $('.tb-match, [class*="match-card"], .am-drow, .am-mrow');
  console.log("Found match nodes:", matchNodes.length);
}
run();
