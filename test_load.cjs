const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
  const res = await axios.get('https://nerdytips.com/all-matches?d=-1', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  console.log("Load more button?", $('.load-more, [id*="load"], [class*="load"], button').length);
  $('.load-more, [id*="load"], [class*="load"], button').each((i, el) => {
    console.log("Found:", $(el).text().trim(), $(el).attr('class'), $(el).attr('id'));
  });
}
run();
