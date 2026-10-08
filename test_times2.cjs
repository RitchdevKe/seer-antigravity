const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('nt_d0.html', 'utf8');
const $ = cheerio.load(html);

$('.am-drow, .tb-match').each((i, el) => {
   const teamA = $(el).find('.am-tn, .tb-tname').first().text().trim();
   const time = $(el).find('.am-tm, .tb-tm').text().trim();
   if (i < 10) console.log(`${teamA} - Time: ${time}`);
});
