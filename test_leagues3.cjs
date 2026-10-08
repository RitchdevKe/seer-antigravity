const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('nt_leagues.html', 'utf8');
const $ = cheerio.load(html);
const links = new Set();
$('a').each((i, el) => {
   const href = $(el).attr('href');
   if (href) links.add(href);
});
console.log(Array.from(links).slice(0, 20));
