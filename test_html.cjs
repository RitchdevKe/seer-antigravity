const cheerio = require('cheerio');
const $ = cheerio.load('<a href="http"><div>Test</div></a>');
const a = $('a').get(0);
console.log('OUTER:', $.html(a));
