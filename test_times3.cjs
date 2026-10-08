const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('nt_d0.html', 'utf8');
const $ = cheerio.load(html);
let ex = 0; let fail = 0;
$('.am-drow, .tb-match').each((i, el) => {
   const time = $(el).find('.score-time, .time, .score-date, .am-mt, [data-time]').text().trim();
   if (time && time.includes(':')) { ex++; }
   else { fail++; }
});
console.log(`Success: ${ex}, Fail: ${fail}`);
