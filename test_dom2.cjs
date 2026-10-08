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
                  const grandparent = $(el).parent().parent();
                  const homeNode = grandparent.find('.md-ps__v--h');
                  const awayNode = grandparent.find('.md-ps__v--a');
                  
                  homeNode.find('.sr-only').remove();
                  awayNode.find('.sr-only').remove();
                  
                  console.log(txt, "=>", homeNode.text().trim(), ":", awayNode.text().trim());
              }
          }
      });
  }
}
run();
