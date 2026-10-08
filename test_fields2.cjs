const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const res = await axios.get('https://nerdytips.com/all-matches?d=2026-08-27', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  
  // tb-match has inner div tb-mrow which has more divs
  // Let's dump the class hierarchy for card 5
  const firstRow = $('.tb-match').eq(5);
  
  // Get ALL classes inside
  const allClasses = new Set();
  firstRow.find('*').each((i, el) => {
    const cls = $(el).attr('class');
    if (cls) cls.split(/\s+/).forEach(c => allClasses.add(c));
  });
  console.log("All classes:", [...allClasses].sort().join(', '));
  
  // Check the odds - they have tb-odd__pill but it returned empty. Let's check nested structure
  const pillEls = firstRow.find('[class*="pill"]');
  console.log("\nElements with pill in class:", pillEls.length);
  pillEls.each((i, el) => {
    console.log("  Class:", $(el).attr('class'), "Text:", $(el).text().trim());
  });
  
  // Check for picks/predictions
  const pickEls = firstRow.find('[class*="pick"]');
  console.log("\nElements with pick in class:", pickEls.length);
  pickEls.each((i, el) => {
    console.log("  Class:", $(el).attr('class'), "Text:", $(el).text().trim());
  });
  
  // Maybe the cards have two sub-layouts (desktop vs mobile)?
  // Let's check the tb-mrow structure
  const mrows = firstRow.find('.tb-mrow');
  console.log("\n.tb-mrow count:", mrows.length);
  
  // Check for odds/predictions in the <a> data attributes  
  const parentA = firstRow.closest('a');
  console.log("\nParent <a> attributes:");
  const attrs = parentA.get(0)?.attribs || {};
  for (const [k, v] of Object.entries(attrs)) {
    if (k !== 'class' && k !== 'data-q') console.log(`  ${k}="${v}"`);
  }
}

run().catch(e => console.error(e.message));
