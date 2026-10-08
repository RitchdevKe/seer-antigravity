const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('test_vip_details.html', 'utf8');
const $ = cheerio.load(html);
let cards = [];
$('.md-pcard, .md-best, .prediction-inline-wrap, [class*="prediction"], div.nt-panel').each((_, el) => {
  cards.push($(el).text().trim());
});
console.log(cards);
