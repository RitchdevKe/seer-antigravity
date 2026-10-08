const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const url = `https://nerdytips.com/all-matches?d=1`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  
  $('script').each((i, el) => {
      const html = $(el).html();
      if (html && html.length > 500) {
          console.log(`\n=== Script ${i} ===\n`);
          console.log(html.substring(0, 500) + '...');
      }
  });
}
run();
