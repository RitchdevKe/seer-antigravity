const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('nt_d0.html', 'utf8');
const $ = cheerio.load(html);

// Find all matches based on href="/match-details/"
let links = 0;
$('a[href*="/match-details/"]').each((i, el) => {
    links++;
});
console.log("Match links:", links);
