const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  // First, scrape the all-matches page and grab a match URL
  const allMatchesRes = await axios.get('https://nerdytips.com/all-matches/2026-08-27/', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(allMatchesRes.data);
  
  // Check what elements exist
  const rows = $('tr.match-row, tr[class*="match"], .match-row, .match-card, .match-item');
  console.log("Match rows found with old selectors:", rows.length);
  
  // Check for any links with match/match-details
  const matchLinks = $('a[href*="/match/"], a[href*="/match-details/"]');
  console.log("Match links found:", matchLinks.length);
  if (matchLinks.length > 0) {
    matchLinks.slice(0, 3).each((i, el) => {
      console.log("  Link:", $(el).attr('href'));
    });
  }
  
  // Let's also check for score-board class  
  const scoreBoards = $('a.score-board');
  console.log("a.score-board found:", scoreBoards.length);
  
  // What about the main structure? Look for tables
  const tables = $('table');
  console.log("Tables found:", tables.length);
  
  // Check for new structure patterns
  const ntCards = $('[class*="nt-"], [class*="md-"]');
  console.log("Elements with nt-/md- class prefix:", ntCards.length);
  
  // Let's just see the structure of the first few interesting elements
  $('a[href*="/match"]').slice(0, 3).each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim().substring(0, 100);
    console.log(`Match link ${i}: href=${href} text="${text}"`);
  });
}

run().catch(e => console.error(e.message));
