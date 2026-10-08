const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const url = 'https://nerdytips.com/match-details/larne-vs-lincoln-red-imps-fc-prediction-1296000';
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  
  // Look for md-1x2--tip
  console.log("=== .md-1x2--tip ===");
  const tip1x2 = $('.md-1x2--tip');
  if (tip1x2.length > 0) {
     console.log("Tip elements found:", tip1x2.length);
     console.log("HTML:", $.html(tip1x2.first()));
     console.log("Extracted Label:", tip1x2.find('.md-1x2__l').text().trim());
  }

  console.log("\n=== .md-conf__val ===");
  const confVals = $('.md-conf__val');
  if (confVals.length > 0) {
      console.log("HTML:", $.html(confVals.first()));
      console.log("Extracted Rating:", confVals.first().text().trim());
  }

  // Look for other prediction sections if any
  const tips = [];
  $('.md-tip').each((i, el) => {
    tips.push($(el).text().trim());
  });
  console.log("\n=== Other tips (.md-tip) ===", tips);
  
  // Check the title of the confidence block
  const confBlock = confVals.first().closest('[class*="card"], [class*="block"]');
  console.log("Confidence Block HTML (first 200):", $.html(confBlock).substring(0,200));

}

run().catch(e => console.error(e.message));
