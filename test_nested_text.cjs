const cheerio = require('cheerio');
const html = `<span class="nt-nm"><span class="nt-nm-l">Municipal Grecia</span></span>`;
const $row = cheerio.load(html);
const text = $row('span').find('.nt-nm-l, .nt-nm').text();
console.log('Result:', text);
