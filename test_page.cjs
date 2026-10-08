const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
  const p1 = await axios.get('https://nerdytips.com/all-matches?d=-1', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const p2 = await axios.get('https://nerdytips.com/all-matches?d=-1&p=2', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const page2 = await axios.get('https://nerdytips.com/all-matches?d=-1&page=2', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  console.log("p=1:", cheerio.load(p1.data)('.tb-match').length);
  console.log("p=2:", cheerio.load(p2.data)('.tb-match').length);
  console.log("page=2:", cheerio.load(page2.data)('.tb-match').length);
}
run();
