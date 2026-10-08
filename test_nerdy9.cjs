const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('nerdy_get_d.html', 'utf8');
const $ = cheerio.load(html);
const rows = $('.tb-match').toArray();
console.log('Total matches found in HTML:', rows.length);
