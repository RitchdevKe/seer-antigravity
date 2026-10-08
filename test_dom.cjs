const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
  const search = await axios.get('https://nerdytips.com/search/suggest?q=Madrid', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (search.data && search.data.matches && search.data.matches.length > 0) {
      const match = search.data.matches[0];
      const res = await axios.get(`https://nerdytips.com${match.url}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const $ = cheerio.load(res.data);
      
      $('*').each((i, el) => {
          if ($(el).children().length === 0) {
              const txt = $(el).text().trim().toLowerCase();
              if (txt === 'wins' || txt === 'goals scored' || txt === 'goals against') {
                  console.log("Found:", txt);
                  console.log("Parent HTML:", $(el).parent().html().trim());
                  console.log("Parent's parent HTML:", $(el).parent().parent().html().trim());
              }
          }
      });
  }
}
run();
