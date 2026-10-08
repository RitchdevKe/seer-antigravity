const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const url = `https://nerdytips.com/all-matches?d=1`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  
  // print all buttons
  $('button').each((i, el) => {
      console.log($(el).text().trim());
  });
}
run();
