const cheerio = require('cheerio');
const axios = require('axios');

async function test() {
  const { data } = await axios.get('https://nerdytips.com/all-matches');
  const $ = cheerio.load(data);
  const rows = $('.tb-match, .nt-row');
  
  let count = 0;
  rows.each((i, el) => {
    if (count > 0) return;
    const teamLines = $(el).find('.tb-teamline, .nt-tl');
    if (teamLines.length === 2) {
      console.log('--- TEAM 1 HTML ---');
      console.log($(teamLines[0]).html().trim());
      console.log('EXTRACTED 1:', $(teamLines[0]).find('.tb-tname, .nt-nm-l, .nt-nm').text().trim());
      console.log('--- TEAM 2 HTML ---');
      console.log($(teamLines[1]).html().trim());
      console.log('EXTRACTED 2:', $(teamLines[1]).find('.tb-tname, .nt-nm-l, .nt-nm').text().trim());
      count++;
    }
  });
}
test();
