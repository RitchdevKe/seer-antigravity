const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const res = await axios.get('https://nerdytips.com/all-matches?d=2026-08-27', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  
  // Get the DESKTOP row (am-drow) for card 5
  const desktopRow = $('div.am-drow.tb-match').eq(5);
  
  // Odds are in tb-mrow__odds > tb-odd > .num.tb-odd__pill
  const odds = [];
  desktopRow.find('.tb-odd__pill').each((i, el) => {
    const txt = $(el).text().trim();
    if (txt) odds.push(txt);
  });
  console.log("Desktop odds:", odds);
  
  // Pred/tip  
  const picks = [];
  desktopRow.find('.tb-mcell__pick').each((i, el) => picks.push($(el).text().trim()));
  console.log("Desktop picks:", picks);
  
  const pickOdds = [];
  desktopRow.find('.tb-mcell__odd').each((i, el) => pickOdds.push($(el).text().trim()));
  console.log("Desktop pick odds:", pickOdds);
  
  const trust = desktopRow.find('.tb-trust__val').text().trim();
  console.log("Desktop trust:", trust);
  
  // GS goal prediction from the detail page is what matters for GS, not from listing
  // The listing page GS was always optional
  
  // Now check what the current code would get for time
  const time = desktopRow.find('.score-time, .time, .score-date, .am-mt, [data-time]').text().trim();
  console.log("Time from old selectors:", time);
  
  // The time is in tb-hh and tb-mm with sr-only colon
  const hh = desktopRow.find('.tb-hh').first().text().trim();
  const mm = desktopRow.find('.tb-mm').first().text().trim();
  console.log("Time from new:", hh + ":" + mm);
}

run().catch(e => console.error(e.message));
