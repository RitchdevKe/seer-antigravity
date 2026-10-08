const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
  const res = await axios.get('https://nerdytips.com/predictions/football-predictions-for-today', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log("Status:", res.status);
  const $ = cheerio.load(res.data);
  console.log("tb-match count:", $('.tb-match').length);
}
run();
