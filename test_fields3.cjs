const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const res = await axios.get('https://nerdytips.com/all-matches?d=2026-08-27', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  
  // There are 88 .tb-match but only 44 links. Maybe there are TWO .tb-match per link (desktop + mobile)?
  const cards = $('a[href*="/match-details/"]');
  console.log("Cards:", cards.length);
  
  cards.eq(5).find('.tb-match').each((i, el) => {
    console.log(`\n--- .tb-match ${i} ---`);
    console.log("Classes:", $(el).attr('class'));
    console.log("HTML (300 chars):", $.html(el).substring(0, 300));
  });
  
  // Check card 5's odds from new selectors
  const card5 = cards.eq(5);
  
  // Odds
  const odds = [];
  card5.find('.num.tb-odd__pill, [class*="tb-odd"]').each((i, el) => {
    odds.push($(el).text().trim());
  });
  console.log("\nOdds from card5 a-tag:", odds);
  
  // Try am-meta__odd  
  const amOdds = [];
  card5.find('.am-meta__odd').each((i, el) => amOdds.push($(el).text().trim()));
  console.log("am-meta__odd:", amOdds);
  
  // Prediction from am-pill
  const pred = card5.find('.am-pill').text().trim();
  console.log("am-pill pred:", pred);
  
  // Trust
  const trust = card5.find('.am-meta__conf, .tb-trust__val').first().text().trim();
  console.log("Trust:", trust);
}

run().catch(e => console.error(e.message));
