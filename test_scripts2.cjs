const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const url = `https://nerdytips.com/all-matches?d=0`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  
  const scripts = [];
  $('script[src]').each((i, el) => {
     scripts.push($(el).attr('src'));
  });
  console.log("Scripts:", scripts);
}
run();
