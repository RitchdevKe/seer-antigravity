const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('nt_d0.html', 'utf8');
const $ = cheerio.load(html);

// Look at the locked matches
const lockedMatchElements = $('.nt-lock-wrap, .is-locked, [data-locked="true"]');
console.log("Locked wrap elements:", lockedMatchElements.length);

// Try to print the HTML of the first locked match
if (lockedMatchElements.length > 0) {
    console.log("Locked match HTML:\n", $.html(lockedMatchElements.first()).substring(0, 500));
}

// Let's just look at any element that contains "Unlock"
$('div').each((i, el) => {
    if ($(el).text().includes('Unlock all') && $(el).text().includes('predictions')) {
         console.log("Unlock section HTML:\n", $.html($(el).parent()).substring(0, 500));
         return false; // break
    }
});
