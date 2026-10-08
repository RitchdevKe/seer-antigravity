const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('nt_leagues.html', 'utf8');
const $ = cheerio.load(html);
const leagueLinks = $('a[href*="/football-leagues/"]');
console.log("League links:", leagueLinks.length);
if (leagueLinks.length > 0) {
    console.log("First 3:", $(leagueLinks[0]).attr('href'), $(leagueLinks[1]).attr('href'), $(leagueLinks[2]).attr('href'));
}
