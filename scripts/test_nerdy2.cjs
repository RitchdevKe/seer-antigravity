const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const res = await axios.get('https://nerdytips.com/predictions');
    const $ = cheerio.load(res.data);
    const firstMatch = $('a[href*="/match-details/"], a[href*="/match/"]').first().attr('href');
    if (!firstMatch) {
      console.log('No matches found. HTML size:', res.data.length);
      return;
    }
    console.log('Fetching', firstMatch);
    const matchUrl = firstMatch.startsWith('http') ? firstMatch : 'https://nerdytips.com' + firstMatch;
    const matchRes = await axios.get(matchUrl);
    const $details = cheerio.load(matchRes.data);
    let count = 0;
    $details('.prediction-inline-wrap, [class*="prediction"], div.nt-panel').each((_, wrap) => {
      const title = $details(wrap).find('h4, header, .prediction-title').text().trim().toLowerCase();
      const score = $details(wrap).find('.nt-tips-score').text().trim();
      const tooltip = $details(wrap).find('.tooltiptext').text().trim();
      console.log('--- Panel ---');
      console.log('Title:', title);
      console.log('Score:', score);
      console.log('Tooltip:', tooltip);
      count++;
    });
    console.log('Total panels:', count);
  } catch (e) {
    console.error(e.message);
  }
}
test();
