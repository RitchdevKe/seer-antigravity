const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const res = await axios.get('https://nerdytips.com/predictions');
    const $ = cheerio.load(res.data);
    const firstMatch = $('a.nt-match-link, a[href*="/predictions/"]').first().attr('href');
    if (!firstMatch) { console.log('no match found'); return; }
    console.log('Fetching', firstMatch);
    const matchUrl = firstMatch.startsWith('http') ? firstMatch : 'https://nerdytips.com' + firstMatch;
    
    // We need to bypass login if possible or just fetch public page
    const matchRes = await axios.get(matchUrl);
    const $details = cheerio.load(matchRes.data);
    let count = 0;
    $details('.prediction-inline-wrap, [class*="prediction"], div.nt-panel').each((_, wrap) => {
      const title = $details(wrap).find('h4, header, .prediction-title').text().trim().toLowerCase();
      const score = $details(wrap).find('.nt-tips-score').text().trim();
      const tooltip = $details(wrap).find('.tooltiptext').text().trim().toLowerCase();
      const strong = $details(wrap).find('.nt-tips-score strong').text().trim();
      const wrapText = $details(wrap).text().replace(/\s+/g, ' ').trim().toLowerCase();
      
      console.log('---');
      console.log('Title:', title);
      console.log('Score:', score);
      console.log('Strong:', strong);
      console.log('Tooltip:', tooltip);
      console.log('WrapText:', wrapText);
      count++;
    });
    
    if (count === 0) {
      console.log("No panels found. Dumping HTML of first few lines:");
      console.log($details('body').html().substring(0, 1000));
    }
  } catch (e) {
    console.error(e.message);
  }
}
test();
