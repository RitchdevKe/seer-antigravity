const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('test_vip_details.html', 'utf8');
const $ = cheerio.load(html);
$('script[type="application/ld+json"]').each((i, el) => {
  const data = JSON.parse($(el).text());
  console.log(JSON.stringify(data, null, 2));
});
