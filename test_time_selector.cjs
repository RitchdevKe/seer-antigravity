const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('nt_d0.html', 'utf8');
const $ = cheerio.load(html);

let extracted = 0;
let timeEmpty = 0;

$('.am-drow, .tb-match').each((i, el) => {
   let time = $(el).find('.num.tb-stwrap, .num.am-mt, .am-mt, [data-time]').text().trim();
   if (time) extracted++;
   else timeEmpty++;
});
console.log(`Extracted times: ${extracted}, Empty: ${timeEmpty}`);
