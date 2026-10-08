const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('nt_d0.html', 'utf8');
const $ = cheerio.load(html);

const firstMatch = $('.am-drow, .tb-match').eq(2);
console.log($.html(firstMatch).substring(0, 500));
