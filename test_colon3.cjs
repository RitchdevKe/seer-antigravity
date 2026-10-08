const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('nt_d0.html', 'utf8');
const $ = cheerio.load(html);

$('.am-drow, .tb-match').each((i, el) => {
   const text = $(el).text();
   if (/\d{2}:\d{2}/.test(text)) {
       console.log($.html(el).substring(0, 500));
       return false;
   }
});
