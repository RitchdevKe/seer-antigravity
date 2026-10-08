const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const res = await axios.get('https://nerdytips.com/all-matches?d=2026-08-27', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  
  // What do the match links look like structurally?
  const firstLink = $('a[href*="/match-details/"]').first();
  console.log("=== First match card ===");
  console.log("Tag:", firstLink.prop('tagName'));
  console.log("Class:", firstLink.attr('class'));
  console.log("Outer HTML (first 500):", $.html(firstLink).substring(0, 500));
  
  console.log("\n=== Looking for parent container ===");
  const parent = firstLink.parent();
  console.log("Parent tag:", parent.prop('tagName'));
  console.log("Parent class:", parent.attr('class'));
  
  // Check all match cards
  const cards = $('a[href*="/match-details/"]');
  console.log("\n=== Total match cards:", cards.length, "===");
  
  // Let's look at a card's inner structure to find team names, time, etc.
  const card = cards.eq(5);
  console.log("\n=== Card 5 inner structure ===");
  const innerHtml = $.html(card);
  // Print just the classes and text
  card.find('*').each((i, el) => {
    const cls = $(el).attr('class');
    const text = $(el).clone().children().remove().end().text().trim();
    if (cls && text) {
      console.log(`  .${cls} => "${text.substring(0, 80)}"`);
    }
  });
}

run().catch(e => console.error(e.message));
