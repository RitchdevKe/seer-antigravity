const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const url = `https://nerdytips.com/all-matches?d=1`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  
  // Look for any pagination, load more, or total count elements
  console.log("=== Checking for pagination/load more ===");
  $('*').each((i, el) => {
      const text = $(el).text().toLowerCase();
      if ($(el).children().length === 0) {
          if (text.includes('load more') || text.includes('next page') || text.includes('page 2') || text.includes('show more')) {
              console.log("Found:", text);
              console.log("HTML:", $.html($(el).parent()));
          }
      }
  });

  // Let's also check for any script tags containing matches data
  console.log("\n=== Checking script tags for initial state ===");
  $('script').each((i, el) => {
      const html = $(el).html();
      if (html && html.includes('matches')) {
          console.log(`Script ${i} length:`, html.length);
          if (html.includes('total')) {
             console.log("Snippet:", html.substring(0, 200));
          }
      }
  });
}
run();
