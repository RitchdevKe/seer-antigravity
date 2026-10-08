const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log("Fetching matches for", today);
    const resp = await axios.post('https://nerdytips.com/all-matches/get-matches', new URLSearchParams({
        date: today,
        type: 'all',
        page: '1',
        country: '',
        all_remaining: '0'
    }).toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0'
        }
    });

    const $ = cheerio.load(resp.data);
    const rows = $('tr[class*="match"], tr.match-row').toArray();
    console.log(`Found ${rows.length} rows`);
    let tested = 0;
    
    for (let i = 0; i < rows.length; i++) {
        const el = rows[i];
        const matchUrl = $(el).find('a.score-board, a[href*="/match-details/"], a[href*="/match/"]').attr('href');
        if (!matchUrl) continue;
        
        const urlToFetch = matchUrl.startsWith('http') ? matchUrl : `https://nerdytips.com${matchUrl}`;
        console.log(`\nFetching ${urlToFetch}`);
        
        const detailsPage = await axios.get(urlToFetch, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $details = cheerio.load(detailsPage.data);
        
        $details('.prediction-inline-wrap, [class*="prediction"], div.nt-panel').each((_, wrap) => {
            const title = $details(wrap).find('h4, header, .prediction-title').text().trim().toLowerCase();
            if (title.includes('1x2') || title.includes('1 x 2') || $details(wrap).text().toLowerCase().includes('1x2')) {
                console.log("FOUND WRAP with title:", title);
                console.log("HTML:", $details(wrap).html().replace(/\n/g, '').substring(0, 500));
            }
        });
        
        tested++;
        if (tested >= 3) break;
    }
  } catch (e) {
      console.error(e);
  }
}

test();
