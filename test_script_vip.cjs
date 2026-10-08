const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('test_vip_details.html', 'utf8');
const $ = cheerio.load(html);
let found = false;
$('script').each((i, el) => {
  const text = $(el).text();
  if (text.includes('1x2') || text.includes('1X2') || text.includes('prediction')) {
    console.log(text.substring(0, 300));
    found = true;
  }
});
if(!found) console.log('Not found in scripts');
